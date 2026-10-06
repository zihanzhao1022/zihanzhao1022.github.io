import { describe, expect, it, vi } from 'vitest';
import { ConflictError, contentPath, createGitHubBackend, describeSaveError } from './backend';
import { GitHubApi, GitHubError, TreeEntry, WorkflowRun } from './github';
import { SiteContent } from '../types';
import fixture from '../views/__fixtures__/content.json';

const current = fixture as SiteContent;
const image = { path: 'public/images/uploads/x.png', base64: 'AAAA', previewUrl: 'blob:x' };

/** A fake GitHub whose files are the fixture, except for any overrides. */
function fakeApi(overrides: Partial<Record<keyof SiteContent, unknown>> = {}) {
  const files: Record<string, string> = {};
  for (const key of Object.keys(current) as (keyof SiteContent)[]) {
    files[contentPath(key)] = JSON.stringify(overrides[key] ?? current[key]);
  }
  return {
    headSha: vi.fn(async () => 'head1'),
    treeSha: vi.fn(async (_commit: string) => 'tree1'),
    readText: vi.fn(async (path: string, _ref: string) => files[path]),
    createBlob: vi.fn(async (_base64: string) => 'blob1'),
    createTree: vi.fn(async (_base: string, _entries: TreeEntry[]) => 'tree2'),
    createCommit: vi.fn(async (_message: string, _tree: string, _parent: string) => 'commit1'),
    updateBranch: vi.fn(async (_sha: string) => {}),
    latestRun: vi.fn(async (_sha: string): Promise<WorkflowRun | null> => null),
  } satisfies GitHubApi;
}

describe('GitHub backend', () => {
  it('loads every content file from the latest commit', async () => {
    const api = fakeApi();
    expect(await createGitHubBackend(api).load()).toEqual(current);
    expect(api.readText).toHaveBeenCalledTimes(7);
    expect(api.readText).toHaveBeenCalledWith('content/news.json', 'head1');
  });

  it('commits the changed file and new images together', async () => {
    const api = fakeApi();
    const item = { id: 'n-new', date: 'Oct 6, 2026', content: 'Hello' };
    const result = await createGitHubBackend(api).save(
      { kind: 'upsert', collection: 'news', item },
      [image],
      'content: add news item "Hello"',
      current,
    );

    expect(result.commitSha).toBe('commit1');
    expect(result.content.news[0]).toEqual(item);
    expect(api.createBlob).toHaveBeenCalledWith('AAAA');
    expect(api.createTree).toHaveBeenCalledWith('tree1', [
      {
        path: 'content/news.json',
        mode: '100644',
        type: 'blob',
        content: `${JSON.stringify(result.content.news, null, 2)}\n`,
      },
      { path: 'public/images/uploads/x.png', mode: '100644', type: 'blob', sha: 'blob1' },
    ]);
    expect(api.createCommit).toHaveBeenCalledWith('content: add news item "Hello"', 'tree2', 'head1');
    expect(api.updateBranch).toHaveBeenCalledWith('commit1');
  });

  it('applies the edit to the version on GitHub, not to the page copy', async () => {
    const remoteNews = [{ id: 'n-remote', date: 'x', content: 'added on another device' }, ...current.news];
    const api = fakeApi({ news: remoteNews });
    const result = await createGitHubBackend(api).save({ kind: 'delete', collection: 'news', id: 'n1' }, [], 'm', current);
    expect(result.content.news).toEqual([remoteNews[0]]);
    expect(result.content.talks).toBe(current.talks);
  });

  it('starts over when main moved in the meantime', async () => {
    const api = fakeApi();
    api.updateBranch.mockRejectedValueOnce(new GitHubError('GitHub 返回 422', 422));
    const result = await createGitHubBackend(api).save({ kind: 'delete', collection: 'news', id: 'n1' }, [image], 'm', current);
    expect(result.commitSha).toBe('commit1');
    expect(api.headSha).toHaveBeenCalledTimes(2);
    expect(api.createBlob).toHaveBeenCalledTimes(1);
  });

  it('gives up after three conflicts', async () => {
    const api = fakeApi();
    api.updateBranch.mockRejectedValue(new GitHubError('GitHub 返回 422', 422));
    await expect(
      createGitHubBackend(api).save({ kind: 'delete', collection: 'news', id: 'n1' }, [], 'm', current),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(api.updateBranch).toHaveBeenCalledTimes(3);
  });

  it('does not retry other errors', async () => {
    const api = fakeApi();
    api.updateBranch.mockRejectedValue(new GitHubError('GitHub 返回 401', 401));
    await expect(
      createGitHubBackend(api).save({ kind: 'delete', collection: 'news', id: 'n1' }, [], 'm', current),
    ).rejects.toMatchObject({ status: 401 });
    expect(api.updateBranch).toHaveBeenCalledTimes(1);
  });

  it('maps workflow runs to deployment states', async () => {
    const api = fakeApi();
    const backend = createGitHubBackend(api);
    expect(await backend.deployStatus('c')).toEqual({ state: 'pending' });
    api.latestRun.mockResolvedValueOnce({ status: 'in_progress', conclusion: null, html_url: 'u' });
    expect(await backend.deployStatus('c')).toEqual({ state: 'pending', url: 'u' });
    api.latestRun.mockResolvedValueOnce({ status: 'completed', conclusion: 'success', html_url: 'u' });
    expect(await backend.deployStatus('c')).toEqual({ state: 'success', url: 'u' });
    api.latestRun.mockResolvedValueOnce({ status: 'completed', conclusion: 'failure', html_url: 'u' });
    expect(await backend.deployStatus('c')).toEqual({ state: 'failure', url: 'u' });
  });
});

describe('describeSaveError', () => {
  it('explains common failures in plain words', () => {
    expect(describeSaveError(new ConflictError())).toMatch('别处');
    expect(describeSaveError(new GitHubError('x', 401))).toMatch('登录已过期');
    expect(describeSaveError(new GitHubError('x', 403))).toMatch('没有写入权限');
    expect(describeSaveError(new GitHubError('x', 0))).toMatch('网络');
    expect(describeSaveError(new GitHubError('x', 500))).toMatch('500');
  });
});
