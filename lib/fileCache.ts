/**
 * Private results files kept in this browser (Cache Storage), so a paper opens and compiles without
 * downloading them again. Only files whose key changes with their contents belong here: PDFs, whose names
 * carry a hash, and attachments under their content hash. Each account has its own cache, and signing out
 * deletes them all.
 */
export interface FileCache {
  /** The kept bytes, or null when this browser does not have them or does not keep such a file. */
  read(path: string, version?: string): Promise<Uint8Array | null>;
  /** Keeps the bytes when the path, or the version given with it, names these contents. */
  remember(path: string, data: Uint8Array, version?: string): void;
}

const PREFIX = 'results-files-v1-';
const keyUrl = (key: string): string => `/results-files/${encodeURIComponent(key)}`;

/** Block and bibliography PDFs: results/<paper>/<block or "references">-<hash>.pdf. */
const HASHED_PDF = /^results\/[^/]+\/[^/]+-[0-9a-f]{8}\.pdf$/;

/** The key a private file is kept under: its path when the name carries a hash, else path and content hash. */
export function fileKey(path: string, version?: string): string | null {
  if (version) return `${path}#${version}`;
  return HASHED_PDF.test(path) ? path : null;
}

export function fileCache(account: string): FileCache {
  let opened: Promise<Cache | null> | null = null;
  const open = (): Promise<Cache | null> =>
    (opened ??= (async () => {
      try {
        return await caches.open(PREFIX + account.toLowerCase());
      } catch {
        // No Cache Storage (private windows, tests): files are simply downloaded each time.
        return null;
      }
    })());
  return {
    async read(path, version) {
      const key = fileKey(path, version);
      if (!key) return null;
      try {
        const res = await (await open())?.match(keyUrl(key));
        return res ? new Uint8Array(await res.arrayBuffer()) : null;
      } catch {
        return null;
      }
    },
    remember(path, data, version) {
      const key = fileKey(path, version);
      if (!key) return;
      void open()
        .then((cache) => cache?.put(keyUrl(key), new Response(data.slice())))
        .catch(() => undefined);
    },
  };
}

/** Deletes every account's kept files, e.g. when someone signs out. */
export async function clearFileCaches(): Promise<void> {
  try {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(PREFIX)).map((name) => caches.delete(name)));
  } catch {
    // No Cache Storage: nothing was kept.
  }
}
