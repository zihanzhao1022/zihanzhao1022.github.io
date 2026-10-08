/**
 * pdfTeX (SwiftLaTeX, WebAssembly) in a worker. The site bundles the engine and common TeX Live files
 * under public/texlive/; anything else comes from TeXlyre's TeX Live server and is kept in Cache Storage.
 * Only file names leave the browser, never the document being compiled.
 */

export interface CompileInput {
  /** The text of main.tex. */
  main: string;
  /** Other files in the working directory, by relative path (attachments, main.aux). */
  files?: Record<string, string | Uint8Array>;
}

export interface CompileOutput {
  /** pdfTeX finished normally and wrote a PDF. TeX errors may still be in the log. */
  ok: boolean;
  status: number;
  log: string;
  pdf?: Uint8Array;
  /** main.aux after the run: the labels this document defined. */
  aux?: string;
}

export interface TexEngine {
  compile(input: CompileInput): Promise<CompileOutput>;
}

interface Manifest {
  /** Handed to the worker up front; stored as files/<name>.gz. */
  preload: Record<string, string>;
  /** Fetched by the worker from files/ when TeX asks: "format/request" → file name. */
  files: Record<string, string>;
  /** Requests known to have no file, so the worker never asks the remote server for them. */
  missing?: string[];
}

interface WorkerReply {
  cmd?: string;
  result?: string;
  status?: number;
  log?: string;
  pdf?: ArrayBuffer;
  data?: unknown;
  key?: string;
  fileid?: string;
}

interface PreloadFile {
  key: string;
  fileid: string;
  data: ArrayBuffer;
}

const REMOTE_CACHE = 'texlive-remote-v1';
/** A compile that runs longer is stuck (e.g. a macro that expands forever); its worker is replaced. */
const COMPILE_TIMEOUT_MS = 45_000;
const REMOTE_PREFIX = '/texlive-remote/';
const LOAD_FAILED = 'TeX 引擎加载失败，请检查网络后重试';

const assetUrl = (path: string): string => new URL(`texlive/${path}`, document.baseURI).href;

/** The bytes of a .gz asset, decompressed; a host that already sent it with Content-Encoding: gzip is fine too. */
async function gunzip(res: Response): Promise<ArrayBuffer> {
  if (!res.ok) throw new Error(LOAD_FAILED);
  const bytes = await res.arrayBuffer();
  const head = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
  if (head[0] !== 0x1f || head[1] !== 0x8b) return bytes;
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}

async function cachedRemoteFiles(): Promise<PreloadFile[]> {
  try {
    const cache = await caches.open(REMOTE_CACHE);
    const files = await Promise.all(
      (await cache.keys()).map(async (request) => {
        const res = await cache.match(request);
        const fileid = res?.headers.get('fileid');
        if (!res || !fileid) return null;
        const key = decodeURIComponent(new URL(request.url).pathname.slice(REMOTE_PREFIX.length));
        return { key, fileid, data: await res.arrayBuffer() };
      }),
    );
    return files.filter((file): file is PreloadFile => file !== null);
  } catch {
    // Cache Storage can be unavailable (private windows); the files are simply downloaded again.
    return [];
  }
}

function rememberRemoteFile(key: string, fileid: string, data: ArrayBuffer): void {
  caches
    .open(REMOTE_CACHE)
    .then((cache) => cache.put(REMOTE_PREFIX + encodeURIComponent(key), new Response(data, { headers: { fileid } })))
    .catch(() => undefined);
}

class WorkerEngine implements TexEngine {
  private waiting: { cmd: string; resolve: (reply: WorkerReply) => void } | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  /** Set once the worker has crashed, timed out or been replaced; every later request fails at once. */
  private dead = false;

  constructor(
    private readonly worker: Worker,
    private readonly onCrash: () => void,
  ) {
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const reply = event.data;
      if (reply.cmd === 'fetched') {
        if (reply.key && reply.fileid && reply.data instanceof ArrayBuffer) rememberRemoteFile(reply.key, reply.fileid, reply.data);
        return;
      }
      if (this.waiting && reply.cmd === this.waiting.cmd) {
        const { resolve } = this.waiting;
        this.waiting = null;
        resolve(reply);
      }
    };
    worker.onerror = () => this.retire('TeX 引擎意外退出');
  }

  /** Stops using this worker: answers the open request with a failure, and lets the next compile start a new one. */
  private retire(log: string): void {
    if (this.dead) return;
    this.dead = true;
    this.worker.terminate();
    this.onCrash();
    if (this.waiting) {
      const { cmd, resolve } = this.waiting;
      this.waiting = null;
      resolve({ cmd, result: 'failed', status: -254, log });
    }
  }

  private post(message: Record<string, unknown>, transfer: Transferable[] = []): void {
    if (!this.dead) this.worker.postMessage(message, transfer);
  }

  private request(message: Record<string, unknown>, cmd: string, transfer: Transferable[] = [], timeoutMs = 0): Promise<WorkerReply> {
    if (this.dead) return Promise.resolve({ cmd, result: 'failed', status: -254, log: 'TeX 引擎已重启，请重新编译' });
    return new Promise((resolve) => {
      const timer = timeoutMs > 0 ? setTimeout(() => this.retire('编译超时：可能有无限循环的宏'), timeoutMs) : undefined;
      this.waiting = {
        cmd,
        resolve: (reply) => {
          clearTimeout(timer);
          resolve(reply);
        },
      };
      this.post(message, transfer);
    });
  }

  async preload(files: PreloadFile[]): Promise<void> {
    const reply = await this.request({ cmd: 'preload', files }, 'preload', files.map((file) => file.data));
    if (reply.result !== 'ok') throw new Error(LOAD_FAILED);
  }

  compile(input: CompileInput): Promise<CompileOutput> {
    const run = this.queue.then(() => this.run(input));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async run({ main, files = {} }: CompileInput): Promise<CompileOutput> {
    // Start from an empty working directory so nothing leaks from the previous block.
    this.post({ cmd: 'flushcache' });
    const dirs = new Set<string>();
    for (const path of Object.keys(files)) {
      const parts = path.split('/');
      for (let depth = 1; depth < parts.length; depth += 1) dirs.add(parts.slice(0, depth).join('/'));
    }
    [...dirs]
      .sort((a, b) => a.split('/').length - b.split('/').length)
      .forEach((dir) => this.post({ cmd: 'mkdir', url: dir }));
    for (const [path, content] of Object.entries(files)) this.post({ cmd: 'writefile', url: path, src: content });
    this.post({ cmd: 'writefile', url: 'main.tex', src: main });
    this.post({ cmd: 'setmainfile', url: 'main.tex' });

    const reply = await this.request({ cmd: 'compilelatex' }, 'compile', [], COMPILE_TIMEOUT_MS);
    if (reply.status === -254) {
      // The WebAssembly module aborted (or never answered) and cannot be reused; the next compile starts a new worker.
      this.retire(reply.log ?? '');
      return { ok: false, status: -254, log: reply.log ?? '' };
    }
    const pdf = reply.result === 'ok' && reply.pdf ? new Uint8Array(reply.pdf) : undefined;
    const aux = await this.request({ cmd: 'readfile', url: 'main.aux' }, 'readfile');
    return {
      ok: reply.status === 0 && pdf !== undefined,
      status: reply.status ?? -1,
      log: reply.log ?? '',
      pdf,
      aux: aux.result === 'ok' && typeof aux.data === 'string' ? aux.data : undefined,
    };
  }
}

async function startEngine(onCrash: () => void): Promise<TexEngine> {
  const worker = new Worker(assetUrl('swiftlatexpdftex.js'));
  try {
    await new Promise<void>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<WorkerReply>) => {
        if (event.data.result === 'ok' && !event.data.cmd) resolve();
        else reject(new Error(LOAD_FAILED));
      };
      worker.onerror = () => reject(new Error(LOAD_FAILED));
    });
    const res = await fetch(assetUrl('manifest.json'));
    if (!res.ok) throw new Error(LOAD_FAILED);
    const manifest = (await res.json()) as Manifest;
    worker.postMessage({ cmd: 'setbundle', base: assetUrl('files/'), files: manifest.files, missing: manifest.missing ?? [] });
    const bundled = await Promise.all(
      Object.entries(manifest.preload).map(async ([key, fileid]) => ({
        key,
        fileid,
        data: await gunzip(await fetch(assetUrl(`files/${fileid}.gz`))),
      })),
    );
    const engine = new WorkerEngine(worker, onCrash);
    await engine.preload([...bundled, ...(await cachedRemoteFiles())]);
    return engine;
  } catch (error) {
    worker.terminate();
    throw error instanceof Error ? error : new Error(LOAD_FAILED);
  }
}

let started: Promise<TexEngine> | null = null;

/** The shared engine, started on first use (a few MB of downloads the first time). */
export function getTexEngine(): Promise<TexEngine> {
  if (!started) {
    const reset = (): void => {
      started = null;
    };
    started = startEngine(reset).catch((error: unknown) => {
      reset();
      throw error;
    });
  }
  return started;
}
