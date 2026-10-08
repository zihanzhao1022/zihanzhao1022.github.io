import { describe, expect, it, vi } from 'vitest';
import { ResultPaper } from '../../types';
import { ConflictError } from '../errors';
import { ResultsOp } from './ops';
import { COLLABORATOR_UPLOAD_LIMIT, WorkerError, createWorkerResultsBackend } from './workerBackend';

const paper: ResultPaper = { id: 'p1', slug: 'p1', title: 'Made-up', authors: [], blocks: [] };
const op: ResultsOp = { kind: 'putBlock', paperId: 'p1', block: { id: 'blk-1', kind: 'text', source: 'Made-up' } };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** A fake worker that records what the site sends. */
function fakeWorker(answer: (path: string, body: Record<string, unknown>) => Response) {
  const calls: { path: string; body: Record<string, unknown>; init?: RequestInit }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    calls.push({ path, body, init });
    return answer(path, body);
  });
  return { calls, fetchMock };
}

describe('collaborator backend', () => {
  it('uploads each written file, then saves the edit with their receipts', async () => {
    const worker = fakeWorker((path, body) =>
      path === '/results/upload'
        ? reply({ path: body.path, sha: `sha-of-${String(body.path)}`, receipt: 'signed' })
        : reply({ papers: [paper], roles: { p1: 'editor' } }),
    );
    const backend = createWorkerResultsBackend('the-session', worker.fetchMock);
    const data = new Uint8Array([37, 80, 68, 70]);
    const result = await backend.save(op, [{ path: 'results/p1/blk-1-aaaa.pdf', data }], ['results/p1/blk-1-old.pdf'], 'm', 'pm');

    expect(worker.calls.map((call) => call.path)).toEqual(['/results/upload', '/results/save']);
    expect(worker.calls[0].body).toEqual({ paperId: 'p1', path: 'results/p1/blk-1-aaaa.pdf', base64: 'JVBERg==' });
    expect(worker.calls[1].body).toEqual({
      paperId: 'p1',
      op,
      blobs: [{ path: 'results/p1/blk-1-aaaa.pdf', sha: 'sha-of-results/p1/blk-1-aaaa.pdf', receipt: 'signed' }],
      deletes: ['results/p1/blk-1-old.pdf'],
      message: 'm',
    });
    expect((worker.calls[1].init?.headers as Record<string, string>).Authorization).toBe('Bearer the-session');
    expect(result).toEqual({ papers: [paper], publicCommit: null, roles: { p1: 'editor' } });
    // What it just wrote is served from memory.
    expect(await backend.readFile('results/p1/blk-1-aaaa.pdf')).toBe(data);
    expect(worker.calls).toHaveLength(2);
  });

  it('refuses a file over 1 MB before sending anything', async () => {
    const worker = fakeWorker(() => reply({}));
    const backend = createWorkerResultsBackend('s', worker.fetchMock);
    const big = new Uint8Array(COLLABORATOR_UPLOAD_LIMIT + 1);
    await expect(backend.save(op, [{ path: 'results/p1/files/photo.png', data: big }], [], 'm', 'pm')).rejects.toThrow(
      'photo.png 超过 1 MB',
    );
    expect(worker.calls).toHaveLength(0);
  });

  it('explains refusals and failures', async () => {
    const answer = (status: number, body: unknown = {}) =>
      createWorkerResultsBackend('s', fakeWorker(() => reply(body, status)).fetchMock).load();
    await expect(answer(401)).rejects.toMatchObject({ status: 401, message: '登录已过期，请重新登录' });
    await expect(answer(403)).rejects.toBeInstanceOf(WorkerError);
    await expect(answer(409)).rejects.toBeInstanceOf(ConflictError);
    await expect(answer(400, { error: 'bad_request', message: '只能修改导言区' })).rejects.toThrow('只能修改导言区');
    const offline = vi.fn(async () => {
      throw new TypeError('offline');
    });
    await expect(createWorkerResultsBackend('s', offline).load()).rejects.toMatchObject({ status: 0 });
  });

  it('never writes to the site', async () => {
    const worker = fakeWorker(() => reply({}));
    const backend = createWorkerResultsBackend('s', worker.fetchMock);
    expect(await backend.resync('m')).toBeNull();
    expect(await backend.syncPublic([paper], 'm')).toBeNull();
    expect(worker.calls).toHaveLength(0);
  });
});
