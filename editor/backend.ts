import { EDITOR_CONFIG } from './config';
import { GitHubApi, GitHubError, TreeEntry, createGitHubApi } from './github';
import { ContentOp, applyOp } from './ops';
import { Session } from '../lib/session';
import { SiteContent } from '../types';

export interface ImageUpload {
  /** Repository path, e.g. "public/images/uploads/20261006-153012-logo.png". */
  path: string;
  base64: string;
  previewUrl: string;
}

export type DeployState = 'pending' | 'success' | 'failure' | 'unknown';

export interface DeployStatus {
  state: DeployState;
  url?: string;
}

export interface SaveResult {
  content: SiteContent;
  commitSha: string;
}

export interface EditorBackend {
  load(): Promise<SiteContent>;
  /** Applies the edit to the latest version on GitHub and commits it together with the images. */
  save(op: ContentOp, uploads: ImageUpload[], message: string, current: SiteContent): Promise<SaveResult>;
  deployStatus(commitSha: string): Promise<DeployStatus>;
}

export class ConflictError extends Error {
  constructor() {
    super('内容已在别处修改，请刷新页面后再试');
  }
}

const COLLECTIONS = ['profile', 'news', 'experiences', 'publications', 'projects', 'talks', 'awards'] as const;
const MAX_ATTEMPTS = 3;

export const contentPath = (collection: keyof SiteContent): string => `content/${collection}.json`;

const serialize = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

export function createGitHubBackend(api: GitHubApi): EditorBackend {
  return {
    async load() {
      const head = await api.headSha();
      const entries = await Promise.all(
        COLLECTIONS.map(async (collection) => [collection, JSON.parse(await api.readText(contentPath(collection), head))]),
      );
      return Object.fromEntries(entries) as SiteContent;
    },

    async save(op, uploads, message, current) {
      const images: TreeEntry[] = await Promise.all(
        uploads.map(async (upload) => ({
          path: upload.path,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: await api.createBlob(upload.base64),
        })),
      );
      for (let attempt = 1; ; attempt += 1) {
        const head = await api.headSha();
        const fresh: unknown = JSON.parse(await api.readText(contentPath(op.collection), head));
        const content = applyOp({ ...current, [op.collection]: fresh } as SiteContent, op);
        const tree = await api.createTree(await api.treeSha(head), [
          { path: contentPath(op.collection), mode: '100644', type: 'blob', content: serialize(content[op.collection]) },
          ...images,
        ]);
        const commitSha = await api.createCommit(message, tree, head);
        try {
          await api.updateBranch(commitSha);
          return { content, commitSha };
        } catch (error) {
          // 422: main moved after we read it (e.g. a save from another device). Start over from the new head.
          if (!(error instanceof GitHubError && error.status === 422)) throw error;
          if (attempt >= MAX_ATTEMPTS) throw new ConflictError();
        }
      }
    },

    async deployStatus(commitSha) {
      const run = await api.latestRun(commitSha);
      if (!run) return { state: 'pending' };
      if (run.status !== 'completed') return { state: 'pending', url: run.html_url };
      return { state: run.conclusion === 'success' ? 'success' : 'failure', url: run.html_url };
    },
  };
}

export function describeSaveError(error: unknown): string {
  if (error instanceof ConflictError) return error.message;
  if (error instanceof GitHubError) {
    if (error.status === 401) return '登录已过期，请先复制你的修改，再重新登录后保存';
    if (error.status === 403 || error.status === 404) return '没有写入权限，请确认 GitHub App 已安装到这个仓库';
    if (error.status === 0) return '网络连接失败，请检查网络后重试';
    return `保存失败（GitHub 返回 ${error.status}），请稍后重试`;
  }
  return error instanceof Error ? error.message : '保存失败，请稍后重试';
}

export async function createBackend(session: Session): Promise<EditorBackend> {
  // Written out in full (not MOCK_MODE) so production builds drop the mock module entirely.
  if (import.meta.env.DEV && import.meta.env.VITE_EDITOR_MOCK === 'true') {
    const { createMockBackend } = await import('./mockBackend');
    return createMockBackend();
  }
  return createGitHubBackend(createGitHubApi(session.token, EDITOR_CONFIG));
}
