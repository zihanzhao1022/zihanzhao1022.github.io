import { ResultPaper, ResultsSiteAccess } from '../../types';
import { ConflictError } from '../errors';
import { GitHubError } from '../github';
import { ResultsBackend, toBase64 } from './backend';
import { GitHubUser, canReadFile, checkEditorOp, hasAnyRole, isPaperPath, paperOfPath, papersFor, roleOf } from './collaborators';
import { ResultsOp, applyResultsOp, referencedPaths, touchedPapers } from './ops';
import { hasPublished, isEmptyPlan, planPublicSync, publicPath } from './snapshot';
import { COLLABORATOR_UPLOAD_LIMIT, WorkerError, tooLarge } from './workerBackend';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Simulate failures while testing by hand, e.g. localStorage.setItem('mock-fail', 'publish').
// Values: conflict | network | expired (saving), publish (updating the site), missing (no private repository).
const failure = (): string | null => {
  try {
    return localStorage.getItem('mock-fail');
  } catch {
    return null;
  }
};

/** The fake private repository and the fake site, shared by the owner's and collaborators' mock backends. */
interface Store {
  papers: ResultPaper[];
  access?: ResultsSiteAccess;
  files: Map<string, Uint8Array>;
  publicJson: string;
  publicFiles: string[];
  commits: number;
}

// Kept across reloads so one can sign in as the owner, share a paper, then sign in as a collaborator.
// Start over with localStorage.removeItem('mock-results-store').
const STORE_KEY = 'mock-results-store';
let store: Store | null = null;

const fromBase64 = (text: string): Uint8Array => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

function openStore(): Store {
  if (store) return store;
  store = { papers: [], files: new Map(), publicJson: '[]\n', publicFiles: [], commits: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as
      | (Omit<Store, 'files'> & { files: Record<string, string> })
      | null;
    if (saved) store = { ...saved, files: new Map(Object.entries(saved.files).map(([path, data]) => [path, fromBase64(data)])) };
  } catch {
    // Starts empty.
  }
  return store;
}

function persist(data: Store): void {
  try {
    const files = Object.fromEntries([...data.files].map(([path, bytes]) => [path, toBase64(bytes)]));
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...data, files }));
  } catch {
    // Too big for localStorage: the store simply lasts until the page reloads.
  }
}

/** Writes and deletes files the way the real repository does: only unused files are deleted. */
function applyFiles(data: Store, writes: { path: string; data: Uint8Array }[], deletes: string[]): void {
  writes.forEach((write) => data.files.set(write.path, write.data));
  const used = referencedPaths(data.papers);
  deletes.filter((path) => !used.has(path)).forEach((path) => data.files.delete(path));
}

/** A stand-in for the private repository and the site's copy, used by `npm run dev:mock`. */
export function createMockResultsBackend(): ResultsBackend {
  const data = openStore();

  const syncPublic = async (next: ResultPaper[], message: string): Promise<string | null> => {
    await wait(400);
    if (failure() === 'publish') throw new GitHubError('GitHub 返回 500', 500);
    const plan = planPublicSync(next, data.publicJson, data.publicFiles);
    if (isEmptyPlan(plan)) return null;
    if (plan.json !== null) data.publicJson = plan.json;
    data.publicFiles = [...data.publicFiles.filter((path) => !plan.remove.includes(path)), ...plan.add.map(publicPath)];
    data.commits += 1;
    persist(data);
    console.info(`[mock site commit] ${message}`, { add: plan.add, remove: plan.remove });
    return `mock-results-${data.commits}`;
  };

  return {
    async load() {
      await wait(300);
      if (failure() === 'missing') return { state: 'unavailable', reason: 'missing' };
      return { state: 'ready', papers: structuredClone(data.papers) };
    },

    async readFile(path) {
      await wait(50);
      const bytes = data.files.get(path);
      if (!bytes) throw new GitHubError('GitHub 返回 404', 404);
      return bytes;
    },

    async save(op, writes, deletes, message, publicMessage) {
      await wait(500);
      const mode = failure();
      if (mode === 'conflict') throw new ConflictError();
      if (mode === 'network') throw new GitHubError('网络连接失败', 0);
      if (mode === 'expired') throw new GitHubError('GitHub 返回 401', 401);
      const before = data.papers;
      data.papers = applyResultsOp(data.papers, op);
      applyFiles(data, writes, deletes);
      persist(data);
      console.info(`[mock private commit] ${message}`, { write: writes.map((write) => write.path), delete: deletes });
      const result = structuredClone(data.papers);
      if (!hasPublished(before) && !hasPublished(data.papers)) return { papers: result, publicCommit: null };
      try {
        return { papers: result, publicCommit: await syncPublic(data.papers, publicMessage) };
      } catch (publicError) {
        return { papers: result, publicCommit: null, publicError };
      }
    },

    syncPublic,

    resync: (message) => syncPublic(data.papers, message),

    async loadAccess() {
      return structuredClone(data.access ?? {});
    },

    async saveAccess(access, message) {
      await wait(300);
      data.access = structuredClone(access);
      persist(data);
      console.info(`[mock private commit] ${message}`, access);
    },
  };
}

/** A stand-in for the worker, checking the same rules, for a collaborator signed in under `npm run dev:mock`. */
export function createMockCollaboratorBackend(user: GitHubUser): ResultsBackend {
  const data = openStore();
  const refused = () => new WorkerError('你没有这篇论文的权限，或者作者已经取消了共享', 403);

  return {
    async load() {
      await wait(300);
      if (!hasAnyRole(data.papers, user, data.access)) throw refused();
      const shared = papersFor(data.papers, user, true, data.access);
      return { state: 'ready', papers: structuredClone(shared.papers), roles: shared.roles };
    },

    async readFile(path) {
      await wait(50);
      const paper = data.papers.find((item) => item.id === paperOfPath(path));
      const role = paper ? roleOf(paper, user, data.access) : null;
      if (!paper || !role || !canReadFile(paper, role, path)) throw refused();
      const bytes = data.files.get(path);
      if (!bytes) throw new WorkerError('文件不存在', 404);
      return bytes;
    },

    async save(op, writes, deletes, message) {
      await wait(500);
      const [paperId] = touchedPapers(op);
      // Like the worker, check what arrives as JSON.
      const checked = checkEditorOp(JSON.parse(JSON.stringify(op)) as unknown, paperId);
      if ('error' in checked) throw new WorkerError(checked.error, 400);
      const paper = data.papers.find((item) => item.id === paperId);
      if (!paper || roleOf(paper, user) !== 'editor') throw refused();
      const big = writes.find((write) => write.data.length > COLLABORATOR_UPLOAD_LIMIT);
      if (big) throw tooLarge(big.path);
      if (![...writes.map((write) => write.path), ...deletes].every((path) => isPaperPath(paperId, path))) {
        throw new WorkerError('文件位置不对', 400);
      }
      const edit: ResultsOp = { kind: 'batch', ops: [checked.op, { kind: 'noteEdit', paperId, login: user.login }] };
      data.papers = applyResultsOp(data.papers, edit);
      applyFiles(data, writes, deletes);
      persist(data);
      console.info(`[mock private commit] ${message} (by ${user.login})`, { write: writes.map((write) => write.path), delete: deletes });
      const shared = papersFor(data.papers, user, true, data.access);
      return { papers: structuredClone(shared.papers), publicCommit: null, roles: shared.roles };
    },

    syncPublic: async () => null,
    resync: async () => null,
  };
}
