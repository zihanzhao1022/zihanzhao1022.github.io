import { describe, expect, it, vi } from 'vitest';
import { ResultPaper } from '../../types';
import { ConflictError } from '../errors';
import { GitHubApi, GitHubError, RepoFile, TreeEntry, WorkflowRun } from '../github';
import { GENERIC_PUBLIC_MESSAGE, RESULTS_PATH, createResultsBackend, toBase64 } from './backend';
import { snapshotText } from './snapshot';

const output = (pdf: string) => ({ pdf, width: 300, height: 90 });

const draft: ResultPaper = {
  id: 'p1',
  slug: 'draft',
  title: 'Draft paper',
  authors: [],
  hidden: true,
  blocks: [{ id: 'b1', kind: 'table', source: '% made up', output: output('results/p1/b1-old.pdf') }],
};

/** A fake repository: text files, binary files and the files listed in its tree. */
function fakeRepo(text: Record<string, string> = {}, bytes: Record<string, Uint8Array<ArrayBuffer>> = {}, listed: string[] = []) {
  return {
    headSha: vi.fn(async () => 'head1'),
    treeSha: vi.fn(async (_commit: string) => 'tree1'),
    readText: vi.fn(async (path: string, _ref: string) => text[path]),
    readTextIfExists: vi.fn(async (path: string, _ref: string): Promise<string | null> => text[path] ?? null),
    readBytes: vi.fn(async (path: string, _ref: string) => {
      if (text[path] !== undefined) return new TextEncoder().encode(text[path]);
      if (bytes[path]) return bytes[path];
      throw new GitHubError('GitHub 返回 404', 404);
    }),
    listFiles: vi.fn(async (_tree: string, prefix: string): Promise<RepoFile[]> =>
      listed.filter((path) => path.startsWith(prefix)).map((path) => ({ path, sha: `sha-${path}` })),
    ),
    createBlob: vi.fn(async (base64: string) => `blob-${base64}`),
    createTree: vi.fn(async (_base: string, _entries: TreeEntry[]) => 'tree2'),
    createCommit: vi.fn(async (_message: string, _tree: string, _parent: string) => 'commit1'),
    updateBranch: vi.fn(async (_sha: string) => {}),
    latestRun: vi.fn(async (_sha: string): Promise<WorkflowRun | null> => null),
  } satisfies GitHubApi;
}

describe('toBase64', () => {
  it('encodes bytes, including large ones', () => {
    expect(toBase64(new Uint8Array([37, 80, 68, 70]))).toBe('JVBERg==');
    const large = new Uint8Array(100_000).map((_, index) => index % 256);
    expect(atob(toBase64(large)).length).toBe(100_000);
  });
});

describe('loading', () => {
  it('reads the private list', async () => {
    const backend = createResultsBackend(fakeRepo({ [RESULTS_PATH]: JSON.stringify([draft]) }), fakeRepo());
    expect(await backend.load()).toEqual({ state: 'ready', papers: [draft] });
  });

  it('starts empty when the repository has no list yet', async () => {
    expect(await createResultsBackend(fakeRepo(), fakeRepo()).load()).toEqual({ state: 'ready', papers: [] });
  });

  it('reports a missing or empty repository instead of failing', async () => {
    const missing = fakeRepo();
    missing.headSha.mockRejectedValue(new GitHubError('GitHub 返回 404', 404));
    expect(await createResultsBackend(missing, fakeRepo()).load()).toEqual({ state: 'unavailable', reason: 'missing' });
    const empty = fakeRepo();
    empty.headSha.mockRejectedValue(new GitHubError('GitHub 返回 409', 409));
    expect(await createResultsBackend(empty, fakeRepo()).load()).toEqual({ state: 'unavailable', reason: 'empty' });
    const expired = fakeRepo();
    expired.headSha.mockRejectedValue(new GitHubError('GitHub 返回 401', 401));
    await expect(createResultsBackend(expired, fakeRepo()).load()).rejects.toMatchObject({ status: 401 });
  });
});

describe('saving an unpublished paper', () => {
  it('commits the list, new files and deletions to the private repository only', async () => {
    const privateRepo = fakeRepo({ [RESULTS_PATH]: JSON.stringify([draft]) }, {}, ['results/p1/b1-old.pdf']);
    const publicRepo = fakeRepo();
    const pdf = new Uint8Array([1, 2, 3]);
    const block = { id: 'b1', kind: 'table' as const, source: '% new' };
    const result = await createResultsBackend(privateRepo, publicRepo).save(
      {
        kind: 'batch',
        ops: [
          { kind: 'putBlock', paperId: 'p1', block },
          { kind: 'setOutputs', paperId: 'p1', outputs: { b1: output('results/p1/b1-new.pdf') }, sources: { b1: '% new' } },
        ],
      },
      [{ path: 'results/p1/b1-new.pdf', data: pdf }],
      ['results/p1/b1-old.pdf', 'results/p1/never-existed.pdf'],
      'results: update block in "Draft paper"',
      'content: update result',
    );

    expect(result.publicCommit).toBeNull();
    expect(result.papers[0].blocks[0]).toEqual({ ...block, output: output('results/p1/b1-new.pdf') });
    expect(privateRepo.createTree).toHaveBeenCalledWith('tree1', [
      { path: RESULTS_PATH, mode: '100644', type: 'blob', content: `${JSON.stringify(result.papers, null, 2)}\n` },
      { path: 'results/p1/b1-new.pdf', mode: '100644', type: 'blob', sha: `blob-${toBase64(pdf)}` },
      { path: 'results/p1/b1-old.pdf', mode: '100644', type: 'blob', sha: null },
    ]);
    expect(privateRepo.createCommit).toHaveBeenCalledWith('results: update block in "Draft paper"', 'tree2', 'head1');
    expect(publicRepo.headSha).not.toHaveBeenCalled();
  });

  it('keeps files the list still uses and skips commits that change nothing', async () => {
    const privateRepo = fakeRepo({ [RESULTS_PATH]: JSON.stringify([draft]) }, {}, ['results/p1/b1-old.pdf']);
    const backend = createResultsBackend(privateRepo, fakeRepo());
    // A stale caller asks to delete the PDF that block b1 still shows.
    await backend.save({ kind: 'setBlockHidden', paperId: 'p1', blockId: 'b1', hidden: true }, [], ['results/p1/b1-old.pdf'], 'm', 'pm');
    expect(privateRepo.createTree.mock.calls[0][1]).toHaveLength(1);
    const unchanged = fakeRepo({ [RESULTS_PATH]: `${JSON.stringify([draft], null, 2)}\n` });
    await createResultsBackend(unchanged, fakeRepo()).save({ kind: 'reorderBlocks', paperId: 'p1', ids: ['b1'] }, [], [], 'm', 'pm');
    expect(unchanged.createCommit).not.toHaveBeenCalled();
  });

  it('serves files it just wrote from memory', async () => {
    const privateRepo = fakeRepo({ [RESULTS_PATH]: '[]' });
    const backend = createResultsBackend(privateRepo, fakeRepo());
    const data = new Uint8Array([9]);
    await backend.save({ kind: 'putPaper', paper: draft }, [{ path: 'results/p1/x.pdf', data }], [], 'm', 'pm');
    expect(await backend.readFile('results/p1/x.pdf')).toBe(data);
    expect(privateRepo.readBytes).not.toHaveBeenCalledWith('results/p1/x.pdf', expect.anything());
  });

  it('starts over when the private branch moved', async () => {
    const privateRepo = fakeRepo({ [RESULTS_PATH]: '[]' });
    privateRepo.updateBranch.mockRejectedValueOnce(new GitHubError('GitHub 返回 422', 422));
    await createResultsBackend(privateRepo, fakeRepo()).save({ kind: 'putPaper', paper: draft }, [], [], 'm', 'pm');
    expect(privateRepo.headSha).toHaveBeenCalledTimes(2);
  });

  it('gives up after three conflicts', async () => {
    const privateRepo = fakeRepo({ [RESULTS_PATH]: '[]' });
    privateRepo.updateBranch.mockRejectedValue(new GitHubError('GitHub 返回 422', 422));
    await expect(
      createResultsBackend(privateRepo, fakeRepo()).save({ kind: 'putPaper', paper: draft }, [], [], 'm', 'pm'),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('publishing', () => {
  const pdf = new Uint8Array([5, 6]);
  const privateFiles = { 'results/p1/b1-old.pdf': pdf };

  it('copies the published files and snapshot to the site when a paper is unhidden', async () => {
    const privateRepo = fakeRepo({ [RESULTS_PATH]: JSON.stringify([draft]) }, privateFiles);
    const publicRepo = fakeRepo({ 'content/results.json': '[]\n' }, {}, ['public/results/old/stale.pdf']);
    const result = await createResultsBackend(privateRepo, publicRepo).save(
      { kind: 'setPaperHidden', id: 'p1', hidden: false },
      [],
      [],
      'results: publish "Draft paper"',
      'content: publish result "Draft paper"',
    );

    expect(result.publicCommit).toBe('commit1');
    expect(publicRepo.createTree).toHaveBeenCalledWith('tree1', [
      { path: 'content/results.json', mode: '100644', type: 'blob', content: snapshotText(result.papers) },
      { path: 'public/results/p1/b1-old.pdf', mode: '100644', type: 'blob', sha: `blob-${toBase64(pdf)}` },
      { path: 'public/results/old/stale.pdf', mode: '100644', type: 'blob', sha: null },
    ]);
    expect(publicRepo.createCommit).toHaveBeenCalledWith('content: publish result "Draft paper"', 'tree2', 'head1');
  });

  it('removes a paper from the site when it is hidden again', async () => {
    const published = { ...draft, hidden: undefined };
    const privateRepo = fakeRepo({ [RESULTS_PATH]: JSON.stringify([published]) }, privateFiles);
    const publicRepo = fakeRepo({ 'content/results.json': snapshotText([published]) }, {}, ['public/results/p1/b1-old.pdf']);
    await createResultsBackend(privateRepo, publicRepo).save({ kind: 'setPaperHidden', id: 'p1', hidden: true }, [], [], 'm', 'pm');
    expect(publicRepo.createTree).toHaveBeenCalledWith('tree1', [
      { path: 'content/results.json', mode: '100644', type: 'blob', content: '[]\n' },
      { path: 'public/results/p1/b1-old.pdf', mode: '100644', type: 'blob', sha: null },
    ]);
  });

  it('does not commit to the site when nothing it shows changed', async () => {
    const published = { ...draft, hidden: undefined, blocks: [...draft.blocks, { id: 'b2', kind: 'text' as const, hidden: true }] };
    const privateRepo = fakeRepo({ [RESULTS_PATH]: JSON.stringify([published]) }, privateFiles);
    const publicRepo = fakeRepo({ 'content/results.json': snapshotText([published]) }, {}, ['public/results/p1/b1-old.pdf']);
    const result = await createResultsBackend(privateRepo, publicRepo).save(
      { kind: 'putBlock', paperId: 'p1', block: { id: 'b2', kind: 'text', hidden: true, source: 'still hidden' } },
      [],
      [],
      'm',
      'pm',
    );
    expect(result.publicCommit).toBeNull();
    expect(publicRepo.createCommit).not.toHaveBeenCalled();
  });

  it('never names an unpublished paper in a commit to the site', async () => {
    const published: ResultPaper = { ...draft, id: 'p0', slug: 'public', title: 'Public paper', hidden: undefined };
    const secret: ResultPaper = { ...draft, title: 'Secret submission' };
    const privateRepo = fakeRepo({ [RESULTS_PATH]: JSON.stringify([published, secret]) }, privateFiles);
    // The site is out of date (an earlier sync failed), so this save of the hidden paper triggers a site commit.
    const publicRepo = fakeRepo({ 'content/results.json': '[]\n' });
    await createResultsBackend(privateRepo, publicRepo).save(
      { kind: 'putBlock', paperId: 'p1', block: { id: 'b1', kind: 'table', source: '% new' } },
      [],
      [],
      'results: update block in "Secret submission"',
      'content: update result "Secret submission"',
    );
    expect(publicRepo.createCommit).toHaveBeenCalledWith(GENERIC_PUBLIC_MESSAGE, 'tree2', 'head1');
  });

  it('keeps trying to update the site after a failed sync, and resyncs from the latest list', async () => {
    const published: ResultPaper = { ...draft, hidden: undefined };
    const privateRepo = fakeRepo({ [RESULTS_PATH]: JSON.stringify([published]) }, privateFiles);
    const publicRepo = fakeRepo({ 'content/results.json': snapshotText([published]) }, {}, ['public/results/p1/b1-old.pdf']);
    publicRepo.updateBranch.mockRejectedValueOnce(new GitHubError('GitHub 返回 500', 500));
    const backend = createResultsBackend(privateRepo, publicRepo);
    // Hiding the only published paper: the sync fails, so the site still shows it.
    const failed = await backend.save({ kind: 'setPaperHidden', id: 'p1', hidden: true }, [], [], 'm', 'pm');
    expect(failed.publicError).toBeDefined();
    // Nothing is published any more, yet the next save still brings the site up to date.
    privateRepo.readBytes.mockImplementation(async () => new TextEncoder().encode(JSON.stringify(failed.papers)));
    const next = await backend.save({ kind: 'reorderPapers', ids: ['p1'] }, [], [], 'm', 'content: reorder results');
    expect(next.publicCommit).toBe('commit1');
    const calls = publicRepo.createTree.mock.calls;
    expect(calls[calls.length - 1][1]).toContainEqual({ path: 'content/results.json', mode: '100644', type: 'blob', content: '[]\n' });
    privateRepo.readBytes.mockClear();
    await backend.resync('content: update results');
    expect(privateRepo.readBytes).toHaveBeenCalledWith(RESULTS_PATH, 'head1');
  });

  it('counts the site as behind when a resync fails before reaching it', async () => {
    const privateRepo = fakeRepo({ [RESULTS_PATH]: JSON.stringify([draft]) }, privateFiles);
    // The site still shows p1, which is hidden now.
    const publicRepo = fakeRepo({ 'content/results.json': snapshotText([{ ...draft, hidden: undefined }]) });
    const backend = createResultsBackend(privateRepo, publicRepo);
    privateRepo.headSha.mockRejectedValueOnce(new GitHubError('网络连接失败', 0));
    await expect(backend.resync(GENERIC_PUBLIC_MESSAGE)).rejects.toThrow();
    // So a later save of the hidden paper still brings the site up to date.
    const result = await backend.save({ kind: 'putBlock', paperId: 'p1', block: { id: 'b1', kind: 'table', source: '% new' } }, [], [], 'm', 'pm');
    expect(result.publicCommit).toBe('commit1');
    expect(publicRepo.createCommit).toHaveBeenCalledWith(GENERIC_PUBLIC_MESSAGE, 'tree2', 'head1');
  });

  it('keeps the private save when updating the site fails', async () => {
    const privateRepo = fakeRepo({ [RESULTS_PATH]: JSON.stringify([draft]) }, privateFiles);
    const publicRepo = fakeRepo({ 'content/results.json': '[]\n' });
    publicRepo.updateBranch.mockRejectedValue(new GitHubError('GitHub 返回 500', 500));
    const result = await createResultsBackend(privateRepo, publicRepo).save(
      { kind: 'setPaperHidden', id: 'p1', hidden: false },
      [],
      [],
      'm',
      'pm',
    );
    expect(privateRepo.updateBranch).toHaveBeenCalledWith('commit1');
    expect(result.publicCommit).toBeNull();
    expect(result.publicError).toMatchObject({ status: 500 });
    expect(result.papers[0].hidden).toBeUndefined();
  });
});
