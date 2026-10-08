import { Session } from '../../lib/session';
import { mockUserId } from '../auth';
import { EDITOR_CONFIG } from '../config';
import { createGitHubApi } from '../github';
import { ResultsBackend, createResultsBackend } from './backend';
import { GitHubUser, UserLookup } from './collaborators';
import { createWorkerResultsBackend } from './workerBackend';

// Written out in full (not MOCK_MODE) so production builds drop the mock module entirely.
const mock = (): boolean => import.meta.env.DEV && import.meta.env.VITE_EDITOR_MOCK === 'true';

/** The owner's results backend: the private repository and the site's, with the owner's GitHub token. */
export async function createResults(session: Session): Promise<ResultsBackend> {
  if (mock()) {
    const { createMockResultsBackend } = await import('./mockBackend');
    return createMockResultsBackend();
  }
  const { owner, branch, repo, privateRepo } = EDITOR_CONFIG;
  return createResultsBackend(
    createGitHubApi(session.token, { owner, repo: privateRepo, branch }),
    createGitHubApi(session.token, { owner, repo, branch }),
  );
}

/** A collaborator's results backend: the worker, with their session. */
export async function createCollaboratorResults(session: Session): Promise<ResultsBackend> {
  if (mock()) {
    const { createMockCollaboratorBackend } = await import('./mockBackend');
    return createMockCollaboratorBackend(JSON.parse(session.token) as GitHubUser);
  }
  return createWorkerResultsBackend(session.token);
}

/** Finds GitHub accounts by user name for the owner's paper form. */
export function createUserLookup(session: Session): UserLookup {
  if (mock()) return async (login) => mockUserId(login);
  return async (login) => {
    let res: Response;
    try {
      res = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}`, {
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${session.token}` },
      });
    } catch {
      throw new Error('网络连接失败，请检查网络后重试');
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`查询 GitHub 用户失败（GitHub 返回 ${res.status}），请稍后重试`);
    const user = (await res.json()) as { id?: unknown };
    return typeof user.id === 'number' ? user.id : null;
  };
}
