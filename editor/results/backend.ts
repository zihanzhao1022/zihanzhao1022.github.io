import { Session } from '../../lib/session';
import { ResultPaper } from '../../types';
import { ConflictError } from '../backend';
import { EDITOR_CONFIG } from '../config';
import { GitHubApi, GitHubError, TreeEntry, createGitHubApi } from '../github';
import { ResultsOp, applyResultsOp } from './ops';
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
  | { state: 'ready'; papers: ResultPaper[] }
  /** The private repository is missing, empty, or the GitHub App cannot see it. */
  | { state: 'unavailable'; reason: 'missing' | 'empty' };

export interface ResultsSaveResult {
  papers: ResultPaper[];
  /** Commit on the site's repository when published content changed; it starts a deployment. */
  publicCommit: string | null;
  /** Set when the private save worked but updating the site failed; retry with syncPublic. */
  publicError?: unknown;
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
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  return btoa(binary);
}

const serialize = (papers: ResultPaper[]): string => `${JSON.stringify(papers, null, 2)}\n`;
const isConflict = (error: unknown): boolean => error instanceof GitHubError && error.status === 422;

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

  async function syncPublic(papers: ResultPaper[], message: string): Promise<string | null> {
    for (let attempt = 1; ; attempt += 1) {
      const head = await publicApi.headSha();
      const tree = await publicApi.treeSha(head);
      const [currentJson, existing] = await Promise.all([
        publicApi.readTextIfExists(SNAPSHOT_PATH, head),
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
      const text = await privateApi.readTextIfExists(RESULTS_PATH, head);
      return { state: 'ready', papers: text === null ? [] : (JSON.parse(text) as ResultPaper[]) };
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
      for (let attempt = 1; ; attempt += 1) {
        const head = await privateApi.headSha();
        const tree = await privateApi.treeSha(head);
        const [text, existing] = await Promise.all([
          privateApi.readTextIfExists(RESULTS_PATH, head),
          deletes.length > 0 ? privateApi.listFiles(tree, FILES_PREFIX) : Promise.resolve([]),
        ]);
        const before = text === null ? [] : (JSON.parse(text) as ResultPaper[]);
        const papers = applyResultsOp(before, op);
        // Only delete files that are there: GitHub rejects a tree that removes a missing path.
        const present = new Set(existing.map((file) => file.path));
        const removed = deletes
          .filter((path) => present.has(path))
          .map((path): TreeEntry => ({ path, mode: '100644', type: 'blob', sha: null }));
        const entries: TreeEntry[] = [
          { path: RESULTS_PATH, mode: '100644', type: 'blob', content: serialize(papers) },
          ...blobs,
          ...removed,
        ];
        const commit = await privateApi.createCommit(message, await privateApi.createTree(tree, entries), head);
        try {
          await privateApi.updateBranch(commit);
        } catch (error) {
          if (!isConflict(error)) throw error;
          if (attempt >= MAX_ATTEMPTS) throw new ConflictError();
          continue;
        }
        writes.forEach((write) => files.set(write.path, Promise.resolve(write.data)));
        if (!hasPublished(before) && !hasPublished(papers)) return { papers, publicCommit: null };
        try {
          return { papers, publicCommit: await syncPublic(papers, publicMessage) };
        } catch (publicError) {
          return { papers, publicCommit: null, publicError };
        }
      }
    },

    syncPublic,
  };
}

export async function createResults(session: Session): Promise<ResultsBackend> {
  // Written out in full (not MOCK_MODE) so production builds drop the mock module entirely.
  if (import.meta.env.DEV && import.meta.env.VITE_EDITOR_MOCK === 'true') {
    const { createMockResultsBackend } = await import('./mockBackend');
    return createMockResultsBackend();
  }
  const { owner, branch, repo, privateRepo } = EDITOR_CONFIG;
  return createResultsBackend(
    createGitHubApi(session.token, { owner, repo: privateRepo, branch }),
    createGitHubApi(session.token, { owner, repo, branch }),
  );
}
