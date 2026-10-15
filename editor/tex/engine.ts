/**
 * pdfTeX (SwiftLaTeX, WebAssembly) in a worker. The site bundles the engine and common TeX Live files
 * under public/texlive/; anything else comes from TeXlyre's TeX Live server. Both kinds of files are kept in
 * Cache Storage and handed to the worker when it starts, so compiles rarely wait for a download. Only file
 * names leave the browser, never the document being compiled.
 */
import { N_, PhraseError } from '../../lib/i18n';
import { t } from '../../lib/phrases/results';

export interface CompileInput {
  /** The text of main.tex. */
  main: string;
  /** Other files in the working directory, by relative path (attachments, main.aux). */
  files?: Record<string, string | Uint8Array>;
  /** Run BibTeX after the first pass and compile again, for a document with \bibliography. */
  bibtex?: boolean;
  /** Text files the run writes that the caller wants back (e.g. main.bbl), besides main.aux. */
  read?: string[];
}

export interface CompileOutput {
  /** pdfTeX finished normally and wrote a PDF. TeX errors may still be in the log. */
  ok: boolean;
  status: number;
  log: string;
  pdf?: Uint8Array;
  /** main.aux after the run: the labels this document defined. */
  aux?: string;
  /** Why the engine itself gave up (a compile that never ended, a crash), in words for the owner. */
  reason?: string;
  /** With `bibtex`: BibTeX's log (the .blg is not needed; its messages are in the log). */
  bibtexLog?: string;
  /** The files asked for in `read` that the run wrote. */
  written?: Record<string, string>;
}

export interface TexEngine {
  compile(input: CompileInput): Promise<CompileOutput>;
}

interface Manifest {
  /** Names the bundle's contents (scripts/fetch-texlive.mjs); Cache Storage keeps one version. */
  version?: string;
  /** Stored as files/<name>.gz. */
  preload: Record<string, string>;
  /** "format/request" → file name below files/; the worker fetches them itself if they were not handed over. */
  files: Record<string, string>;
  /** Requests known to have no file, so the worker never asks the remote server for them. */
  missing?: string[];
}

interface WorkerReply {
  cmd?: string;
  result?: string;
  status?: number;
  log?: string;
  /** Set on failures this class reports itself (see CompileOutput.reason). */
  reason?: string;
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
const BUNDLE_CACHE = 'texlive-bundle-';
/** A compile that runs longer is stuck (e.g. a macro that expands forever); its worker is replaced. */
const COMPILE_TIMEOUT_MS = 45_000;
/** Starting takes a few MB of downloads the first time; a start that takes longer has stalled. */
const STARTUP_TIMEOUT_MS = 120_000;
const REMOTE_PREFIX = '/texlive-remote/';
const LOAD_FAILED = N_('TeX 引擎加载失败，请检查网络后重试');

const assetUrl = (path: string): string => new URL(`texlive/${path}`, document.baseURI).href;

/** The bytes of a .gz asset, decompressed; a host that already sent it with Content-Encoding: gzip is fine too. */
async function gunzip(res: Response): Promise<ArrayBuffer> {
  if (!res.ok) throw new PhraseError(() => t(LOAD_FAILED));
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

/** Cache Storage for this version of the bundle, after dropping older versions; null without Cache Storage. */
async function bundleCache(version: string | undefined): Promise<Cache | null> {
  if (!version) return null;
  try {
    const name = BUNDLE_CACHE + version;
    for (const old of await caches.keys()) if (old.startsWith(BUNDLE_CACHE) && old !== name) void caches.delete(old);
    return await caches.open(name);
  } catch {
    return null;
  }
}

/**
 * Every file of the site's bundle, fetched side by side (from Cache Storage after the first time) rather than
 * one at a time while TeX waits. Only the preload files are required: the worker fetches any other file it
 * did not get here when TeX asks for it.
 */
async function bundledFiles(manifest: Manifest): Promise<PreloadFile[]> {
  const cache = await bundleCache(manifest.version);
  const load = async (key: string, fileid: string, gzipped: boolean): Promise<PreloadFile> => {
    const url = assetUrl(`files/${gzipped ? `${fileid}.gz` : fileid}`);
    let res = await cache?.match(url).catch(() => undefined);
    if (!res) {
      res = await fetch(url);
      if (!res.ok) throw new PhraseError(() => t(LOAD_FAILED));
      if (cache) void cache.put(url, res.clone()).catch(() => undefined);
    }
    return { key, fileid, data: gzipped ? await gunzip(res) : await res.arrayBuffer() };
  };
  const [required, optional] = await Promise.all([
    Promise.all(Object.entries(manifest.preload).map(([key, fileid]) => load(key, fileid, true))),
    Promise.all(Object.entries(manifest.files).map(([key, fileid]) => load(key, fileid, false).catch(() => null))),
  ]);
  return [...required, ...optional.filter((file): file is PreloadFile => file !== null)];
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
    worker.onerror = () => this.retire(t('TeX 引擎意外退出'));
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
      resolve({ cmd, result: 'failed', status: -254, log, reason: log });
    }
  }

  private post(message: Record<string, unknown>, transfer: Transferable[] = []): void {
    if (!this.dead) this.worker.postMessage(message, transfer);
  }

  private request(message: Record<string, unknown>, cmd: string, transfer: Transferable[] = [], timeoutMs = 0): Promise<WorkerReply> {
    if (this.dead) {
      const reason = t('TeX 引擎已重启，请重新编译');
      return Promise.resolve({ cmd, result: 'failed', status: -254, log: reason, reason });
    }
    return new Promise((resolve) => {
      const timer = timeoutMs > 0 ? setTimeout(() => this.retire(t('编译超时：可能有无限循环的宏')), timeoutMs) : undefined;
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
    if (reply.result !== 'ok') throw new PhraseError(() => t(LOAD_FAILED));
  }

  compile(input: CompileInput): Promise<CompileOutput> {
    const run = this.queue.then(() => this.run(input));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async run({ main, files = {}, bibtex = false, read = [] }: CompileInput): Promise<CompileOutput> {
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

    let reply = await this.request({ cmd: 'compilelatex' }, 'compile', [], COMPILE_TIMEOUT_MS);
    let bibtexLog: string | undefined;
    if (bibtex && reply.status !== -254) {
      // The first pass wrote the citations to main.aux; BibTeX turns them into main.bbl for the second.
      const bib = await this.request({ cmd: 'bibtex' }, 'bibtex', [], COMPILE_TIMEOUT_MS);
      bibtexLog = bib.log ?? '';
      if (bib.status === -254) {
        this.retire(bib.reason ?? t('BibTeX 意外退出'));
        return { ok: false, status: -254, log: bibtexLog, reason: bib.reason ?? t('BibTeX 意外退出'), bibtexLog };
      }
      reply = await this.request({ cmd: 'compilelatex' }, 'compile', [], COMPILE_TIMEOUT_MS);
    }
    if (reply.status === -254) {
      // The WebAssembly module aborted (or never answered) and cannot be reused; the next compile starts a new worker.
      this.retire(reply.log ?? '');
      return { ok: false, status: -254, log: reply.log ?? '', reason: reply.reason };
    }
    const pdf = reply.result === 'ok' && reply.pdf ? new Uint8Array(reply.pdf) : undefined;
    const aux = await this.request({ cmd: 'readfile', url: 'main.aux' }, 'readfile');
    const written: Record<string, string> = {};
    for (const name of read) {
      const file = await this.request({ cmd: 'readfile', url: name }, 'readfile');
      if (file.result === 'ok' && typeof file.data === 'string') written[name] = file.data;
    }
    return {
      ok: reply.status === 0 && pdf !== undefined,
      status: reply.status ?? -1,
      log: reply.log ?? '',
      pdf,
      aux: aux.result === 'ok' && typeof aux.data === 'string' ? aux.data : undefined,
      ...(bibtexLog === undefined ? {} : { bibtexLog }),
      ...(read.length > 0 ? { written } : {}),
    };
  }
}

async function startEngine(onCrash: () => void): Promise<TexEngine> {
  const worker = new Worker(assetUrl('swiftlatexpdftex.js'));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stalled = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new PhraseError(() => t(LOAD_FAILED))), STARTUP_TIMEOUT_MS);
  });
  try {
    // Saves wait for compiles in one queue, so a stalled start must fail rather than hold it forever.
    return await Promise.race([setUp(worker, onCrash), stalled]);
  } catch (error) {
    worker.terminate();
    throw error instanceof Error ? error : new PhraseError(() => t(LOAD_FAILED));
  } finally {
    clearTimeout(timer);
  }
}

async function setUp(worker: Worker, onCrash: () => void): Promise<TexEngine> {
  await new Promise<void>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      if (event.data.result === 'ok' && !event.data.cmd) resolve();
      else reject(new PhraseError(() => t(LOAD_FAILED)));
    };
    worker.onerror = () => reject(new PhraseError(() => t(LOAD_FAILED)));
  });
  const res = await fetch(assetUrl('manifest.json'));
  if (!res.ok) throw new PhraseError(() => t(LOAD_FAILED));
  const manifest = (await res.json()) as Manifest;
  worker.postMessage({ cmd: 'setbundle', base: assetUrl('files/'), files: manifest.files, missing: manifest.missing ?? [] });
  const [bundled, remote] = await Promise.all([bundledFiles(manifest), cachedRemoteFiles()]);
  const engine = new WorkerEngine(worker, onCrash);
  await engine.preload([...bundled, ...remote]);
  return engine;
}

let started: Promise<TexEngine> | null = null;

/** Starts the shared engine ahead of the first compile, e.g. when an editor opens a paper. */
export function warmTexEngine(): void {
  getTexEngine().catch(() => undefined);
}

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
