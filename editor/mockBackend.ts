import { bundledContent } from '../content';
import { SiteContent } from '../types';
import { ConflictError, DeployStatus, EditorBackend } from './backend';
import { GitHubError } from './github';
import { applyOp } from './ops';

const DEPLOY_MS = 8_000;
const ACTIONS_URL = 'https://github.com/zihanzhao1022/zihanzhao1022.github.io/actions';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Simulate failures while testing by hand, e.g. localStorage.setItem('mock-fail', 'conflict').
// Values: conflict | network | expired | deploy.
const failure = (): string | null => {
  try {
    return localStorage.getItem('mock-fail');
  } catch {
    return null;
  }
};

/** An in-memory stand-in for GitHub, used by `npm run dev:mock`. */
export function createMockBackend(): EditorBackend {
  let remote: SiteContent = structuredClone(bundledContent);
  const readyAt = new Map<string, number>();
  let commits = 0;

  return {
    async load() {
      await wait(500);
      return structuredClone(remote);
    },

    async save(op, uploads, message, current) {
      await wait(800);
      const mode = failure();
      if (mode === 'conflict') throw new ConflictError();
      if (mode === 'network') throw new GitHubError('网络连接失败', 0);
      if (mode === 'expired') throw new GitHubError('GitHub 返回 401', 401);
      const content = applyOp({ ...current, [op.collection]: remote[op.collection] } as SiteContent, op);
      remote = { ...remote, [op.collection]: content[op.collection] } as SiteContent;
      commits += 1;
      const commitSha = `mock-${commits}`;
      readyAt.set(commitSha, Date.now() + DEPLOY_MS);
      console.info(`[mock commit] ${message}`, uploads.map((upload) => upload.path));
      return { content, commitSha };
    },

    async deployStatus(commitSha): Promise<DeployStatus> {
      if (Date.now() < (readyAt.get(commitSha) ?? 0)) return { state: 'pending' };
      return { state: failure() === 'deploy' ? 'failure' : 'success', url: ACTIONS_URL };
    },
  };
}
