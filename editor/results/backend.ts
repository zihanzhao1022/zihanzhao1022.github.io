import { ResultPaper } from '../../types';
import { EDITOR_CONFIG } from '../config';
import { ConflictError } from '../errors';
import { GitHubApi, GitHubError, TreeEntry } from '../github';
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
  /** A collaborator's roles after the save (see ResultsLoad). */
  roles?: Record<string, PaperRole>;
}

export interface ResultsBackend {
  load(): Promise<ResultsLoad>;
  /** A private file's bytes; files written in this session come from memory. */
  readFile(path: string): Promise<Uint8Array>;
  /**
   * Applies the edit to the latest private list and commits it with the written and deleted files. When a
   * published paper is involved, the site's copy is brought up to date too (`publicMessage` names that commit).
   */
  save(op: ResultsOp, writes: FileWrite[], deletes: string[], message: string, publicMessage: string): Promise<ResultsSaveResult>;
  /** Makes the site's repository show exactly the published papers; null when it already does. */
  syncPublic(papers: ResultPaper[], message: string): Promise<string | null>;
  /** syncPublic with the latest private list, e.g. to retry after a failed sync or to catch up with collaborators. */
  resync(message: string): Promise<string | null>;
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

export interface CommitResult {
  /** The latest list the edit was applied to, and the list after it. */
  before: ResultPaper[];
  papers: ResultPaper[];
  /** False when the edit changed nothing, so nothing was committed. */
  changed: boolean;
}

/**
 * Applies the edit to the latest results.json of the private repository and commits it with the uploaded
 * blobs and the deletions, starting over when the branch moved in between. Deletions are limited to files
 * that exist and that no paper refers to any more. The owner's editor and the Worker (for collaborators)
 * both save through this; `check` sees each list read before the edit is applied, and throws to stop.
 */
export async function commitResults(
  api: GitHubApi,
  op: ResultsOp,
  blobs: TreeEntry[],
  deletes: string[],
  message: string,
  check?: (latest: ResultPaper[]) => void,
): Promise<CommitResult> {
  for (let attempt = 1; ; attempt += 1) {
    const head = await api.headSha();
    const tree = await api.treeSha(head);
    const [text, existing] = await Promise.all([
      readTextFile(api, RESULTS_PATH, head),
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
    if (json === text && blobs.length === 0 && removed.length === 0) return { before, papers, changed: false };
    const entries: TreeEntry[] = [{ path: RESULTS_PATH, mode: '100644', type: 'blob', content: json }, ...blobs, ...removed];
    const commit = await api.createCommit(message, await api.createTree(tree, entries), head);
    try {
      await api.updateBranch(commit);
      return { before, papers, changed: true };
    } catch (error) {
      if (!isConflict(error)) throw error;
      if (attempt >= MAX_ATTEMPTS) throw new ConflictError();
    }
  }
}

export function createResultsBackend(privateApi: GitHubApi, publicApi: GitHubApi): ResultsBackend {
  const files = new Map<string, Promise<Uint8Array>>();

  const readFile = (path: string): Promise<Uint8Array> => {
    let bytes = files.get(path);
    if (!bytes) {
      bytes = privateApi.readBytes(path, EDITOR_CONFIG.branch);
      files.set(path, bytes);
      bytes.catch(() => files.delete(path));
    }
    return bytes;
  };

  // Set while the site's copy may lag behind the private list (a sync failed or is under way).
  let publicBehind = false;

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
      return { state: 'ready', papers: parsePapers(await readTextFile(privateApi, RESULTS_PATH, head)) };
    },

    readFile,

    async save(op, writes, deletes, message, publicMessage) {
      const blobs = await Promise.all(
        writes.map(async (write): Promise<TreeEntry> => ({
          path: write.path,
          mode: '100644',
          type: 'blob',
          sha: await privateApi.createBlob(toBase64(write.data)),
        })),
      );
      const { before, papers, changed } = await commitResults(privateApi, op, blobs, deletes, message);
      writes.forEach((write) => files.set(write.path, Promise.resolve(write.data)));
      if (!publicBehind && (!changed || (!hasPublished(before) && !hasPublished(papers)))) return { papers, publicCommit: null };
      // The site's history is public: name a paper only when it is (or just was) published.
      const touched = touchedPapers(op);
      const named = touched.length === 0 || touched.every((id) => isPublishedIn(before, id) || isPublishedIn(papers, id));
      try {
        return { papers, publicCommit: await syncPublic(papers, named ? publicMessage : GENERIC_PUBLIC_MESSAGE) };
      } catch (publicError) {
        return { papers, publicCommit: null, publicError };
      }
    },

    syncPublic,

    async resync(message) {
      // Behind until this succeeds, even if reading the private list fails first.
      publicBehind = true;
      return syncPublic(parsePapers(await readTextFile(privateApi, RESULTS_PATH, await privateApi.headSha())), message);
    },
  };
}
