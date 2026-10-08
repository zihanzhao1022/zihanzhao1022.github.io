import { describe, expect, it, vi } from 'vitest';
import { GitHubError, createGitHubApi, decodeBase64Utf8 } from './github';

const repo = { owner: 'zihanzhao1022', repo: 'zihanzhao1022.github.io', branch: 'main' };
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe('decodeBase64Utf8', () => {
  it('decodes UTF-8 text with line breaks, as the contents API returns it', () => {
    const text = '子涵 赵 – Bachelor’s 🚀';
    const base64 = btoa(String.fromCharCode(...new TextEncoder().encode(text)));
    expect(decodeBase64Utf8(`${base64.slice(0, 10)}\n${base64.slice(10)}`)).toBe(text);
  });
});

describe('createGitHubApi', () => {
  it('authenticates every request and bypasses the HTTP cache', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ok({ object: { sha: 'abc' } }));
    const api = createGitHubApi('ghu_token', repo, fetchMock);
    expect(await api.headSha()).toBe('abc');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/zihanzhao1022/zihanzhao1022.github.io/git/ref/heads/main');
    expect(init?.cache).toBe('no-store');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer ghu_token');
  });

  it('only fast-forwards the branch', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ok({}));
    await createGitHubApi('t', repo, fetchMock).updateBranch('def');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/git\/refs\/heads\/main$/);
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({ sha: 'def', force: false });
  });

  it('returns null for a file that does not exist, and other failures as errors', async () => {
    const missing = createGitHubApi('t', repo, vi.fn(async () => new Response('{}', { status: 404 })));
    expect(await missing.readTextIfExists('content/results.json', 'abc')).toBeNull();
    const broken = createGitHubApi('t', repo, vi.fn(async () => new Response('{}', { status: 500 })));
    await expect(broken.readTextIfExists('content/results.json', 'abc')).rejects.toMatchObject({ status: 500 });
  });

  it('reads raw bytes with the raw media type', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(new Uint8Array([37, 80, 68, 70])));
    const bytes = await createGitHubApi('t', repo, fetchMock).readBytes('results/a/b.pdf', 'abc');
    expect([...bytes]).toEqual([37, 80, 68, 70]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/contents\/results\/a\/b\.pdf\?ref=abc$/);
    expect((init?.headers as Record<string, string>).Accept).toBe('application/vnd.github.raw+json');
  });

  it('lists the files under a folder of a tree', async () => {
    const tree = {
      truncated: false,
      tree: [
        { path: 'public/results', type: 'tree', sha: 't1' },
        { path: 'public/results/res-a/blk-1.pdf', type: 'blob', sha: 's1' },
        { path: 'public/resultsX.txt', type: 'blob', sha: 's2' },
        { path: 'content/results.json', type: 'blob', sha: 's3' },
      ],
    };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ok(tree));
    const files = await createGitHubApi('t', repo, fetchMock).listFiles('tree1', 'public/results/');
    expect(files).toEqual([{ path: 'public/results/res-a/blk-1.pdf', sha: 's1' }]);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/git\/trees\/tree1\?recursive=1$/);
  });

  it('reports the HTTP status of failures', async () => {
    const api = createGitHubApi('t', repo, vi.fn(async () => new Response('{}', { status: 422 })));
    await expect(api.updateBranch('x')).rejects.toMatchObject({ status: 422 });
  });

  it('reports network failures as status 0', async () => {
    const offline = vi.fn(async () => {
      throw new TypeError('offline');
    });
    const api = createGitHubApi('t', repo, offline);
    await expect(api.headSha()).rejects.toBeInstanceOf(GitHubError);
    await expect(api.headSha()).rejects.toMatchObject({ status: 0 });
  });
});
