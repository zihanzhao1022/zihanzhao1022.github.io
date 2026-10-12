import type { FileCache } from '../../lib/fileCache';
import { Message, N_, PhraseError } from '../../lib/i18n';
import { t } from '../../lib/phrases/results';
import { EDITOR_CONFIG } from '../config';
import { ConflictError } from '../errors';
import { ResultsBackend, toBase64 } from './backend';
import { SharedPapers } from './collaborators';
import { touchedPapers } from './ops';

/** The largest file a collaborator can upload: the worker's limit. */
export const COLLABORATOR_UPLOAD_LIMIT = 1024 * 1024;
/** Uploads sent at once; each file is its own small request to the worker. */
const PARALLEL_UPLOADS = 3;

/** A refusal or failure from the worker, with a message for the collaborator. */
export class WorkerError extends PhraseError {
  readonly status: number;

  constructor(message: Message, status: number) {
    super(message);
    this.status = status;
  }
}

const MESSAGES: Record<number, string> = {
  0: N_('网络连接失败，请检查网络后重试'),
  401: N_('登录已过期，请重新登录'),
  403: N_('你没有这篇论文的权限，或者作者已经取消了共享'),
  413: N_('文件超过 1 MB，协作者暂时不能上传这么大的文件'),
};

export const tooLarge = (path: string): WorkerError =>
  new WorkerError(() => t('{name} 超过 1 MB，协作者暂时不能上传这么大的文件', { name: path.split('/').pop() ?? path }), 413);

/**
 * A collaborator's results backend: every read and write goes through the worker with their session. `cache`
 * keeps the files this browser has read (see lib/fileCache).
 */
export function createWorkerResultsBackend(
  session: string,
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
  cache?: FileCache,
): ResultsBackend {
  const base = EDITOR_CONFIG.workerUrl.replace(/\/+$/, '');

  async function call(path: string, body: unknown): Promise<Response> {
    let res: Response;
    try {
      res = await fetchImpl(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
        body: JSON.stringify(body),
      });
    } catch {
      throw new WorkerError(() => t(MESSAGES[0]), 0);
    }
    if (res.ok) return res;
    if (res.status === 409) throw new ConflictError();
    const detail = (await res.json().catch(() => ({}))) as { message?: unknown };
    // The worker's messages are Chinese phrases (lib/phrases/results.ts); one without a translation stays as sent.
    const message = typeof detail.message === 'string' ? detail.message : MESSAGES[res.status];
    throw new WorkerError(() => (message === undefined ? t('请求失败（{status}），请稍后重试', { status: res.status }) : t(message)), res.status);
  }

  const files = new Map<string, Promise<Uint8Array>>();
  const readFile = (path: string, version?: string): Promise<Uint8Array> => {
    let bytes = files.get(path);
    if (!bytes) {
      bytes = (async () => {
        const kept = await cache?.read(path, version);
        if (kept) return kept;
        const data = new Uint8Array(await (await call('/results/file', { path })).arrayBuffer());
        cache?.remember(path, data, version);
        return data;
      })();
      files.set(path, bytes);
      bytes.catch(() => files.delete(path));
    }
    return bytes;
  };

  return {
    async load() {
      const shared = (await (await call('/results/load', {})).json()) as SharedPapers;
      return { state: 'ready', papers: shared.papers, roles: shared.roles };
    },

    readFile,

    async save(op, writes, deletes, message) {
      const [paperId, ...others] = touchedPapers(op);
      if (!paperId || others.length > 0) throw new PhraseError(() => t('一次只能修改一篇论文'));
      const big = writes.find((write) => write.data.length > COLLABORATOR_UPLOAD_LIMIT);
      if (big) throw tooLarge(big.path);
      // The worker answers each upload with a receipt; the save commits only files that have one.
      const blobs: unknown[] = [];
      for (let at = 0; at < writes.length; at += PARALLEL_UPLOADS) {
        const batch = writes.slice(at, at + PARALLEL_UPLOADS).map(async (write) => {
          const res = await call('/results/upload', { paperId, path: write.path, base64: toBase64(write.data) });
          return (await res.json()) as unknown;
        });
        blobs.push(...(await Promise.all(batch)));
      }
      const shared = (await (await call('/results/save', { paperId, op, blobs, deletes, message })).json()) as SharedPapers;
      writes.forEach((write) => files.set(write.path, Promise.resolve(write.data)));
      return { papers: shared.papers, publicCommit: null, roles: shared.roles };
    },

    // Collaborators never touch the site; the owner publishes their edits.
    syncPublic: async () => null,
    resync: async () => null,
  };
}
