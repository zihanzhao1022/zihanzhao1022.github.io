import type { FileCache } from '../../lib/fileCache';
import { ResultPaper, ResultsSiteAccess } from '../../types';
import { EDITOR_CONFIG } from '../config';
import { ConflictError } from '../errors';
import { GitHubApi, GitHubError, TreeEntry } from '../github';
import { ACCESS_PATH, parseAccess } from './collaborators';
import type { PaperRole } from './collaborators';
import { ResultsOp, applyResultsOp, referencedPaths, touchedPapers } from './ops';
import { PUBLIC_FILES_PREFIX, SNAPSHOT_PATH, hasPublished, isEmptyPlan, planPublicSync, publicPath } from './snapshot';

/** The private repository's list of papers. */
export const RESULTS_PATH = 'results.json';
const FILES_PREFIX = 'results/';
const MAX_ATTEMPTS = 3;

export interface FileWrite {
  /** Private path, e.g. "results/res-a/blk-b-1234abcd.pdf". */
  path: string;
  data: Uint8Array;
}

export type ResultsLoad =
  /** `roles` is set for a collaborator: the papers shared with them and what they may do with each. */
  | { state: 'ready'; papers: ResultPaper[]; roles?: Record<string, PaperRole> }
  /** The private repository is missing, empty, or the GitHub App cannot see it. */
  | { state: 'unavailable'; reason: 'missing' | 'empty' };

export interface ResultsSaveResult {
  papers: ResultPaper[];
  /** Commit on the site's repository when published content changed; it starts a deployment. */
  publicCommit: string | null;
  /** Set when the private save worked but updating the site failed; retry with resync. */
  publicError?: unknown;
  /**
   * The site's copy still to bring up to date (the owner's saves): the save returns once the private commit
   * is in, and the caller runs this after it rather than waiting for both repositories.
   */
  publish?: () => Promise<string | null>;
  /** A collaborator's roles after the save (see ResultsLoad). */
  roles?: Record<string, PaperRole>;
}

export interface ResultsBackend {
  load(): Promise<ResultsLoad>;
  /**
   * A private file's bytes; files written in this session come from memory. `version` (an attachment's content
   * hash) lets the browser keep the file; PDFs, whose names carry a hash, are kept without one.
   */
  readFile(path: string, version?: string): Promise<Uint8Array>;
  /**
   * Applies the edit to the latest private list and commits it with the written and deleted files. When a
   * published paper is involved, the site's copy is brought up to date too (`publicMessage` names that commit).
   */
  save(op: ResultsOp, writes: FileWrite[], deletes: string[], message: string, publicMessage: string): Promise<ResultsSaveResult>;
  /** Makes the site's repository show exactly the published papers; null when it already does. */
  syncPublic(papers: ResultPaper[], message: string): Promise<string | null>;
  /** syncPublic with the latest private list, e.g. to retry after a failed sync or to catch up with collaborators. */
  resync(message: string): Promise<string | null>;
  /** Who may view every paper (results-access.json); the owner's backends only. */
  loadAccess?(): Promise<ResultsSiteAccess>;
  saveAccess?(access: ResultsSiteAccess, message: string): Promise<void>;
}

/** Commit message for the site's repository when no published paper is involved: never names a hidden one. */
export const GENERIC_PUBLIC_MESSAGE = 'content: update results';

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  return btoa(binary);
}

const serialize = (papers: ResultPaper[]): string => `${JSON.stringify(papers, null, 2)}\n`;
const isConflict = (error: unknown): boolean => error instanceof GitHubError && error.status === 422;

/** The papers in results.json's text; a missing file is an empty list. */
export const parsePapers = (text: string | null): ResultPaper[] => (text === null ? [] : (JSON.parse(text) as ResultPaper[]));

/**
 * A JSON or text file's contents, or null if it does not exist. Read as raw bytes: the contents API's JSON
 * form leaves `content` empty for files over 1 MB.
 */
export async function readTextFile(api: GitHubApi, path: string, ref: string): Promise<string | null> {
  try {
    return new TextDecoder().decode(await api.readBytes(path, ref));
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return null;
    throw error;
  }
}

const isPublishedIn = (papers: ResultPaper[], id: string): boolean => papers.some((paper) => paper.id === id && !paper.hidden);

/** A commit of the private branch with its results.json (null: none), so a save there need not read it again. */
export interface KnownHead {
  commit: string;
  text: string | null;
}

export interface CommitResult {
  /** The latest list the edit was applied to, and the list after it. */
  before: ResultPaper[];
  papers: ResultPaper[];
  /** False when the edit changed nothing, so nothing was committed. */
  changed: boolean;
  /** The branch head afterwards: the new commit, or the one read when nothing changed. */
  head: KnownHead;
}

/**
 * Applies the edit to the latest results.json of the private repository and commits it with the uploaded
 * blobs and the deletions, starting over when the branch moved in between. Deletions are limited to files
 * that exist and that no paper refers to any more. The owner's editor and the Worker (for collaborators)
 * both save through this; `check` sees each list read before the edit is applied, and throws to stop.
 * `blobs` may still be uploading; `known`, when the branch has not moved since, saves reading results.json.
 */
export async function commitResults(
  api: GitHubApi,
  op: ResultsOp,
  blobs: TreeEntry[] | Promise<TreeEntry[]>,
  deletes: string[],
  message: string,
  check?: (latest: ResultPaper[]) => void,
  known?: KnownHead | null,
): Promise<CommitResult> {
  // One request for the head and its tree; a retry asks the branch's ref itself, which is never behind.
  const readHead = async (first: boolean): Promise<{ commit: string; tree: string }> => {
    if (first && api.branchHead) return api.branchHead();
    const commit = await api.headSha();
    return { commit, tree: await api.treeSha(commit) };
  };
  for (let attempt = 1; ; attempt += 1) {
    const [{ commit: head, tree }, uploaded] = await Promise.all([readHead(attempt === 1), blobs]);
    const [text, existing] = await Promise.all([
      known && known.commit === head ? Promise.resolve(known.text) : readTextFile(api, RESULTS_PATH, head),
      deletes.length > 0 ? api.listFiles(tree, FILES_PREFIX) : Promise.resolve([]),
    ]);
    const before = parsePapers(text);
    check?.(before);
    const papers = applyResultsOp(before, op);
    const json = serialize(papers);
    // GitHub rejects removing a missing path.
    const present = new Set(existing.map((file) => file.path));
    const used = referencedPaths(papers);
    const removed = deletes
      .filter((path) => present.has(path) && !used.has(path))
      .map((path): TreeEntry => ({ path, mode: '100644', type: 'blob', sha: null }));
    if (json === text && uploaded.length === 0 && removed.length === 0) return { before, papers, changed: false, head: { commit: head, text } };
    const entries: TreeEntry[] = [{ path: RESULTS_PATH, mode: '100644', type: 'blob', content: json }, ...uploaded, ...removed];
    const commit = await api.createCommit(message, await api.createTree(tree, entries), head);
    try {
      await api.updateBranch(commit);
      return { before, papers, changed: true, head: { commit, text: json } };
    } catch (error) {
      if (!isConflict(error)) throw error;
      if (attempt >= MAX_ATTEMPTS) throw new ConflictError();
    }
  }
}

/** The owner's backend; `cache` keeps the files this browser has read (see lib/fileCache). */
export function createResultsBackend(privateApi: GitHubApi, publicApi: GitHubApi, cache?: FileCache): ResultsBackend {
  const files = new Map<string, Promise<Uint8Array>>();

  const readFile = (path: string, version?: string): Promise<Uint8Array> => {
    let bytes = files.get(path);
    if (!bytes) {
      bytes = (async () => {
        const kept = await cache?.read(path, version);
        if (kept) return kept;
        const data = await privateApi.readBytes(path, EDITOR_CONFIG.branch);
        cache?.remember(path, data, version);
        return data;
      })();
      files.set(path, bytes);
      bytes.catch(() => files.delete(path));
    }
    return bytes;
  };

  // Set while the site's copy may lag behind the private list (a sync failed, is under way or is still to run).
  let publicBehind = false;
  // The private branch as this editor last read or wrote it (see commitResults).
  let known: KnownHead | null = null;

  async function syncPublic(papers: ResultPaper[], message: string): Promise<string | null> {
    publicBehind = true;
    const commit = await syncOnce(papers, message);
    publicBehind = false;
    return commit;
  }

  async function syncOnce(papers: ResultPaper[], message: string): Promise<string | null> {
    for (let attempt = 1; ; attempt += 1) {
      const head = await publicApi.headSha();
      const tree = await publicApi.treeSha(head);
      const [currentJson, existing] = await Promise.all([
        readTextFile(publicApi, SNAPSHOT_PATH, head),
        publicApi.listFiles(tree, PUBLIC_FILES_PREFIX),
      ]);
      const plan = planPublicSync(papers, currentJson, existing.map((file) => file.path));
      if (isEmptyPlan(plan)) return null;
      const added = await Promise.all(
        plan.add.map(async (path): Promise<TreeEntry> => ({
          path: publicPath(path),
          mode: '100644',
          type: 'blob',
          sha: await publicApi.createBlob(toBase64(await readFile(path))),
        })),
      );
      const entries: TreeEntry[] = [
        ...(plan.json === null ? [] : [{ path: SNAPSHOT_PATH, mode: '100644' as const, type: 'blob' as const, content: plan.json }]),
        ...added,
        ...plan.remove.map((path): TreeEntry => ({ path, mode: '100644', type: 'blob', sha: null })),
      ];
      const commit = await publicApi.createCommit(message, await publicApi.createTree(tree, entries), head);
      try {
        await publicApi.updateBranch(commit);
        return commit;
      } catch (error) {
        if (!isConflict(error)) throw error;
        if (attempt >= MAX_ATTEMPTS) throw new ConflictError();
      }
    }
  }

  return {
    async load() {
      let head: string;
      try {
        head = await privateApi.headSha();
      } catch (error) {
        // 404: no such repository, or the GitHub App is not installed on it. 409: a repository without commits.
        if (error instanceof GitHubError && error.status === 404) return { state: 'unavailable', reason: 'missing' };
        if (error instanceof GitHubError && error.status === 409) return { state: 'unavailable', reason: 'empty' };
        throw error;
      }
      const text = await readTextFile(privateApi, RESULTS_PATH, head);
      known = { commit: head, text };
      return { state: 'ready', papers: parsePapers(text) };
    },

    readFile,

    async save(op, writes, deletes, message, publicMessage) {
      // Uploaded while commitResults reads the branch.
      const blobs = Promise.all(
        writes.map(async (write): Promise<TreeEntry> => ({
          path: write.path,
          mode: '100644',
          type: 'blob',
          sha: await privateApi.createBlob(toBase64(write.data)),
        })),
      );
      const { before, papers, changed, head } = await commitResults(privateApi, op, blobs, deletes, message, undefined, known);
      known = head;
      writes.forEach((write) => {
        files.set(write.path, Promise.resolve(write.data));
        cache?.remember(write.path, write.data);
      });
      if (!publicBehind && (!changed || (!hasPublished(before) && !hasPublished(papers)))) return { papers, publicCommit: null };
      // The site's history is public: name a paper only when it is (or just was) published.
      const touched = touchedPapers(op);
      const named = touched.length === 0 || touched.every((id) => isPublishedIn(before, id) || isPublishedIn(papers, id));
      publicBehind = true;
      return { papers, publicCommit: null, publish: () => syncPublic(papers, named ? publicMessage : GENERIC_PUBLIC_MESSAGE) };
    },

    syncPublic,

    async resync(message) {
      // Behind until this succeeds, even if reading the private list fails first.
      publicBehind = true;
      return syncPublic(parsePapers(await readTextFile(privateApi, RESULTS_PATH, await privateApi.headSha())), message);
    },

    async loadAccess() {
      return parseAccess(await readTextFile(privateApi, ACCESS_PATH, await privateApi.headSha()));
    },

    async saveAccess(access, message) {
      for (let attempt = 1; ; attempt += 1) {
        const head = await privateApi.headSha();
        const tree = await privateApi.treeSha(head);
        const entry: TreeEntry = { path: ACCESS_PATH, mode: '100644', type: 'blob', content: `${JSON.stringify(access, null, 2)}\n` };
        const commit = await privateApi.createCommit(message, await privateApi.createTree(tree, [entry]), head);
        try {
          await privateApi.updateBranch(commit);
          return;
        } catch (error) {
          if (!isConflict(error)) throw error;
          if (attempt >= MAX_ATTEMPTS) throw new ConflictError();
        }
      }
    },
  };
}
