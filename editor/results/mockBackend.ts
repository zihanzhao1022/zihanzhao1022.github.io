import { ResultPaper } from '../../types';
import { ConflictError } from '../backend';
import { GitHubError } from '../github';
import { ResultsBackend } from './backend';
import { applyResultsOp } from './ops';
import { hasPublished, isEmptyPlan, planPublicSync, publicPath, snapshotText } from './snapshot';

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

/** An in-memory stand-in for the private repository and the site's copy, used by `npm run dev:mock`. */
export function createMockResultsBackend(): ResultsBackend {
  let papers: ResultPaper[] = [];
  const files = new Map<string, Uint8Array>();
  let publicJson = '[]\n';
  let publicFiles: string[] = [];
  let commits = 0;

  const syncPublic = async (next: ResultPaper[], message: string): Promise<string | null> => {
    await wait(400);
    if (failure() === 'publish') throw new GitHubError('GitHub 返回 500', 500);
    const plan = planPublicSync(next, publicJson, publicFiles);
    if (isEmptyPlan(plan)) return null;
    publicJson = snapshotText(next);
    publicFiles = [...publicFiles.filter((path) => !plan.remove.includes(path)), ...plan.add.map(publicPath)];
    commits += 1;
    console.info(`[mock site commit] ${message}`, { add: plan.add, remove: plan.remove });
    return `mock-results-${commits}`;
  };

  return {
    async load() {
      await wait(300);
      if (failure() === 'missing') return { state: 'unavailable', reason: 'missing' };
      return { state: 'ready', papers: structuredClone(papers) };
    },

    async readFile(path) {
      await wait(50);
      const bytes = files.get(path);
      if (!bytes) throw new GitHubError('GitHub 返回 404', 404);
      return bytes;
    },

    async save(op, writes, deletes, message, publicMessage) {
      await wait(500);
      const mode = failure();
      if (mode === 'conflict') throw new ConflictError();
      if (mode === 'network') throw new GitHubError('网络连接失败', 0);
      if (mode === 'expired') throw new GitHubError('GitHub 返回 401', 401);
      const before = papers;
      papers = applyResultsOp(papers, op);
      writes.forEach((write) => files.set(write.path, write.data));
      deletes.forEach((path) => files.delete(path));
      console.info(`[mock private commit] ${message}`, { write: writes.map((write) => write.path), delete: deletes });
      const result = structuredClone(papers);
      if (!hasPublished(before) && !hasPublished(papers)) return { papers: result, publicCommit: null };
      try {
        return { papers: result, publicCommit: await syncPublic(papers, publicMessage) };
      } catch (publicError) {
        return { papers: result, publicCommit: null, publicError };
      }
    },

    syncPublic,
  };
}
