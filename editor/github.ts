export class GitHubError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface RepoRef {
  owner: string;
  repo: string;
  branch: string;
}

export interface TreeEntry {
  path: string;
  mode: '100644';
  type: 'blob';
  sha?: string;
  content?: string;
}

export interface WorkflowRun {
  status: string;
  conclusion: string | null;
  html_url: string;
}

export interface GitHubApi {
  headSha(): Promise<string>;
  treeSha(commitSha: string): Promise<string>;
  readText(path: string, ref: string): Promise<string>;
  createBlob(base64: string): Promise<string>;
  createTree(baseTree: string, entries: TreeEntry[]): Promise<string>;
  createCommit(message: string, tree: string, parent: string): Promise<string>;
  updateBranch(commitSha: string): Promise<void>;
  latestRun(headSha: string): Promise<WorkflowRun | null>;
}

/** The contents API returns base64 with line breaks; the text itself is UTF-8. */
export function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

export function createGitHubApi(
  token: string,
  repo: RepoRef,
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
): GitHubApi {
  const base = `https://api.github.com/repos/${repo.owner}/${repo.repo}`;

  async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetchImpl(`${base}${path}`, {
        method,
        // The API sends max-age=60; a cached branch head would make every save conflict.
        cache: 'no-store',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new GitHubError('网络连接失败', 0);
    }
    if (!res.ok) throw new GitHubError(`GitHub 返回 ${res.status}`, res.status);
    return (await res.json()) as T;
  }

  return {
    headSha: async () => (await request<{ object: { sha: string } }>(`/git/ref/heads/${repo.branch}`)).object.sha,
    treeSha: async (commitSha) => (await request<{ tree: { sha: string } }>(`/git/commits/${commitSha}`)).tree.sha,
    readText: async (path, ref) =>
      decodeBase64Utf8((await request<{ content: string }>(`/contents/${path}?ref=${ref}`)).content),
    createBlob: async (base64) =>
      (await request<{ sha: string }>('/git/blobs', 'POST', { content: base64, encoding: 'base64' })).sha,
    createTree: async (baseTree, entries) =>
      (await request<{ sha: string }>('/git/trees', 'POST', { base_tree: baseTree, tree: entries })).sha,
    createCommit: async (message, tree, parent) =>
      (await request<{ sha: string }>('/git/commits', 'POST', { message, tree, parents: [parent] })).sha,
    updateBranch: async (commitSha) => {
      await request(`/git/refs/heads/${repo.branch}`, 'PATCH', { sha: commitSha, force: false });
    },
    latestRun: async (headSha) =>
      (await request<{ workflow_runs: WorkflowRun[] }>(`/actions/runs?head_sha=${headSha}&per_page=1`)).workflow_runs[0] ??
      null,
  };
}
