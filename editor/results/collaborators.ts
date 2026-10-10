import { ResultBlock, ResultBlockKind, ResultBlockOutput, ResultPaper, ResultsSiteAccess } from '../../types';
import { ResultsOp } from './ops';
import { publicView } from './snapshot';

/**
 * Rules for the people the owner shares a paper with. The Cloudflare Worker enforces them on every request
 * (everything a collaborator sends is untrusted); the site uses the same rules to decide what to show.
 */

export type PaperRole = 'viewer' | 'editor';

/** A signed-in GitHub account: its user name and its permanent numeric ID. */
export interface GitHubUser {
  login: string;
  id: number;
}

/** GitHub user names are case-insensitive; the lists may also hold "@name". */
export const normalLogin = (login: string): string => login.trim().replace(/^@/, '').toLowerCase();

/** Anything with lists of GitHub users: a paper, or the results pages as a whole. */
interface Listed {
  viewers?: string[];
  editors?: string[];
  collaboratorIds?: Record<string, number>;
}

/** Where the private repository keeps who may view every paper. */
export const ACCESS_PATH = 'results-access.json';

/** results-access.json's contents; anything unreadable lists nobody. */
export function parseAccess(text: string | null): ResultsSiteAccess {
  try {
    const raw = (text === null ? {} : JSON.parse(text)) as Record<string, unknown>;
    const viewers = Array.isArray(raw.viewers) ? raw.viewers.filter((name): name is string => typeof name === 'string') : [];
    const ids = typeof raw.collaboratorIds === 'object' && raw.collaboratorIds !== null ? (raw.collaboratorIds as Record<string, unknown>) : {};
    const collaboratorIds = Object.fromEntries(Object.entries(ids).filter((entry): entry is [string, number] => typeof entry[1] === 'number'));
    return viewers.length > 0 ? { viewers, collaboratorIds } : {};
  } catch {
    return {};
  }
}

/** On a list by user name, and the account that had that name when the owner added it. */
function listedAs(item: Listed, user: GitHubUser): PaperRole | null {
  const me = normalLogin(user.login);
  if (!me || item.collaboratorIds?.[me] !== user.id) return null;
  if ((item.editors ?? []).some((name) => normalLogin(name) === me)) return 'editor';
  if ((item.viewers ?? []).some((name) => normalLogin(name) === me)) return 'viewer';
  return null;
}

/**
 * A person's role on a paper (editors may also view), or null: from the paper's own lists, or as a viewer of
 * every paper (`site`, results-access.json).
 */
export function roleOf(paper: ResultPaper, user: GitHubUser, site?: ResultsSiteAccess): PaperRole | null {
  return listedAs(paper, user) ?? (site && listedAs(site, user) ? 'viewer' : null);
}

export const hasAnyRole = (papers: ResultPaper[], user: GitHubUser, site?: ResultsSiteAccess): boolean =>
  (site !== undefined && listedAs(site, user) !== null) || papers.some((paper) => roleOf(paper, user) !== null);

/** A GitHub account's ID by user name; null when there is no such user. */
export type UserLookup = (login: string) => Promise<number | null>;

/**
 * The paper with the account ID of everyone it is shared with, looked up when the owner saves its form. IDs
 * already known are kept, so a user name that was given up and registered again does not pass access to the
 * new account; names no longer listed are dropped.
 */
export async function withCollaboratorIds<T extends Listed>(paper: T, previous: Listed | undefined, lookup: UserLookup): Promise<T> {
  const ids: Record<string, number> = {};
  for (const name of [...(paper.viewers ?? []), ...(paper.editors ?? [])]) {
    const login = normalLogin(name);
    if (!login || ids[login] !== undefined) continue;
    const id = previous?.collaboratorIds?.[login] ?? (await lookup(login));
    if (id === null) throw new Error(`找不到 GitHub 用户 ${name}，请检查用户名`);
    ids[login] = id;
  }
  const { collaboratorIds: _ids, ...rest } = paper;
  return (Object.keys(ids).length > 0 ? { ...rest, collaboratorIds: ids } : rest) as T;
}

export interface SharedPapers {
  /** In the owner's order. */
  papers: ResultPaper[];
  roles: Record<string, PaperRole>;
}

/**
 * The papers shared with someone, as they may receive them. Viewers get what visitors would get if the paper
 * were published: its visible, compiled blocks, no LaTeX. Editors get the whole paper. Nobody gets the lists
 * of who else it is shared with.
 */
export function papersFor(papers: ResultPaper[], user: GitHubUser, editing = true, site?: ResultsSiteAccess): SharedPapers {
  const shared: ResultPaper[] = [];
  const roles: Record<string, PaperRole> = {};
  for (const paper of papers) {
    const found = roleOf(paper, user, site);
    if (!found) continue;
    // While editing is switched off, editors get what viewers get.
    const role: PaperRole = editing ? found : 'viewer';
    roles[paper.id] = role;
    if (role === 'editor') {
      const { viewers: _viewers, editors: _editors, collaboratorIds: _ids, pendingReview: _pending, ...rest } = paper;
      shared.push(rest);
    } else {
      const view = publicView(paper);
      shared.push(paper.hidden ? { ...view, hidden: true } : view);
    }
  }
  return { papers: shared, roles };
}

// A file name with an extension, so a path can never name a folder (results/<id>/files).
const PAPER_FILE = /^results\/([A-Za-z0-9_-]+)\/(?:files\/)?[A-Za-z0-9_][A-Za-z0-9._-]*\.[A-Za-z0-9]+$/;
const OUTPUT_FILE = /^results\/([A-Za-z0-9_-]+)\/[A-Za-z0-9_][A-Za-z0-9._-]*\.pdf$/;

/** The paper a private file belongs to: results/<id>/<name> or results/<id>/files/<name>; null for anything else. */
export const paperOfPath = (path: string): string | null => PAPER_FILE.exec(path)?.[1] ?? null;

/** Whether a path is a file of this paper's folder, and nothing else. */
export const isPaperPath = (paperId: string, path: string): boolean => paperOfPath(path) === paperId;

/** Files a collaborator may read: editors any file of the paper, viewers only the PDFs of visible blocks. */
export function canReadFile(paper: ResultPaper, role: PaperRole, path: string): boolean {
  if (!isPaperPath(paper.id, path)) return false;
  if (role === 'editor') return true;
  return paper.blocks.some((block) => !block.hidden && block.output?.pdf === path) || paper.references?.pdf === path;
}

const KINDS: ResultBlockKind[] = ['text', 'figure', 'table'];
const BLOCK_ID = /^blk-[a-z0-9]+$/;
const FILE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]*\.[A-Za-z0-9]+$/;
const HASH = /^[A-Za-z0-9]{1,64}$/;
/** Generous limits; they only stop requests that no editor would send. */
const MAX_TEXT = 200_000;
const MAX_ITEMS = 1_000;

type Untrusted = Record<string, unknown>;

const isRecord = (value: unknown): value is Untrusted => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.length <= MAX_TEXT;
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isBlockId = (value: unknown): value is string => typeof value === 'string' && BLOCK_ID.test(value);

function isMap<T>(value: unknown, isValue: (item: unknown) => item is T): value is Record<string, T> {
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= MAX_ITEMS && entries.every(([key, item]) => key.length <= 200 && isValue(item));
}

/** A new or edited block as an editor may send it: id, kind, source and visibility, nothing else. */
export function cleanBlock(raw: unknown): ResultBlock | null {
  if (!isRecord(raw) || !isBlockId(raw.id) || !KINDS.includes(raw.kind as ResultBlockKind) || !isText(raw.source)) return null;
  return { id: raw.id, kind: raw.kind as ResultBlockKind, source: raw.source, ...(raw.hidden === true ? { hidden: true } : {}) };
}

/** A compiled output: a PDF in the paper's folder (not among its attachments) and the compile bookkeeping. */
export function cleanOutput(raw: unknown, paperId: string): ResultBlockOutput | null {
  if (!isRecord(raw) || typeof raw.pdf !== 'string' || OUTPUT_FILE.exec(raw.pdf)?.[1] !== paperId) return null;
  if (!isNumber(raw.width) || !isNumber(raw.height)) return null;
  const output: ResultBlockOutput = { pdf: raw.pdf, width: raw.width, height: raw.height };
  if (raw.inputHash !== undefined) {
    if (typeof raw.inputHash !== 'string' || !HASH.test(raw.inputHash)) return null;
    output.inputHash = raw.inputHash;
  }
  if (raw.counters !== undefined) {
    if (!isMap(raw.counters, isNumber)) return null;
    output.counters = raw.counters;
  }
  if (raw.labels !== undefined) {
    if (!isMap(raw.labels, isText)) return null;
    output.labels = raw.labels;
  }
  return output;
}

export type CheckedOp = { op: ResultsOp } | { error: string };

const OTHER_PAPER = '只能修改共享给你的论文';
const MALFORMED = '请求的内容不符合要求';

/**
 * The edit an editor may make to one paper, rebuilt from checked fields; or why it is refused. Editors change
 * blocks, compiled outputs, the preamble and attachments. Publishing, hiding or deleting the paper, its
 * information and who it is shared with stay with the owner.
 */
export function checkEditorOp(raw: unknown, paperId: string, nested = false): CheckedOp {
  if (!isRecord(raw)) return { error: MALFORMED };
  const own = raw.paperId === paperId;
  switch (raw.kind) {
    case 'batch': {
      if (nested || !Array.isArray(raw.ops) || raw.ops.length === 0 || raw.ops.length > MAX_ITEMS) return { error: MALFORMED };
      const ops: ResultsOp[] = [];
      for (const inner of raw.ops) {
        const checked = checkEditorOp(inner, paperId, true);
        if ('error' in checked) return checked;
        ops.push(checked.op);
      }
      return { op: { kind: 'batch', ops } };
    }
    case 'putBlock': {
      if (!own) return { error: OTHER_PAPER };
      const block = cleanBlock(raw.block);
      if (!block || (raw.at !== undefined && !isNumber(raw.at))) return { error: MALFORMED };
      return { op: { kind: 'putBlock', paperId, block, ...(raw.at === undefined ? {} : { at: raw.at as number }) } };
    }
    case 'deleteBlock':
      if (!own) return { error: OTHER_PAPER };
      return isBlockId(raw.blockId) ? { op: { kind: 'deleteBlock', paperId, blockId: raw.blockId } } : { error: MALFORMED };
    case 'setBlockHidden':
      if (!own) return { error: OTHER_PAPER };
      if (!isBlockId(raw.blockId) || typeof raw.hidden !== 'boolean') return { error: MALFORMED };
      return { op: { kind: 'setBlockHidden', paperId, blockId: raw.blockId, hidden: raw.hidden } };
    case 'reorderBlocks': {
      if (!own) return { error: OTHER_PAPER };
      const ids = raw.ids;
      if (!Array.isArray(ids) || ids.length > MAX_ITEMS || !ids.every(isBlockId)) return { error: MALFORMED };
      return { op: { kind: 'reorderBlocks', paperId, ids } };
    }
    case 'setOutputs': {
      if (!own) return { error: OTHER_PAPER };
      if (!isRecord(raw.outputs) || !isMap(raw.sources, isText)) return { error: MALFORMED };
      const outputs: Record<string, ResultBlockOutput> = {};
      const sources: Record<string, string> = {};
      const entries = Object.entries(raw.outputs);
      if (entries.length > MAX_ITEMS) return { error: MALFORMED };
      for (const [blockId, output] of entries) {
        const clean = cleanOutput(output, paperId);
        const source = raw.sources[blockId];
        if (!BLOCK_ID.test(blockId) || !clean || typeof source !== 'string') return { error: MALFORMED };
        outputs[blockId] = clean;
        sources[blockId] = source;
      }
      return { op: { kind: 'setOutputs', paperId, outputs, sources } };
    }
    case 'putFile':
      if (!own) return { error: OTHER_PAPER };
      if (typeof raw.name !== 'string' || !FILE_NAME.test(raw.name) || typeof raw.hash !== 'string' || !HASH.test(raw.hash)) {
        return { error: MALFORMED };
      }
      return { op: { kind: 'putFile', paperId, name: raw.name, hash: raw.hash } };
    case 'removeFile':
      if (!own) return { error: OTHER_PAPER };
      if (typeof raw.name !== 'string' || !FILE_NAME.test(raw.name)) return { error: MALFORMED };
      return { op: { kind: 'removeFile', paperId, name: raw.name } };
    case 'patchPaper': {
      if (raw.id !== paperId) return { error: OTHER_PAPER };
      const fields = raw.fields;
      if (!isRecord(fields) || Object.keys(fields).some((key) => key !== 'preamble') || !isText(fields.preamble)) {
        return { error: '只能修改导言区' };
      }
      return { op: { kind: 'patchPaper', id: paperId, fields: { preamble: fields.preamble } } };
    }
    default:
      return { error: '这个操作只有作者本人能做' };
  }
}
