import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearFileCaches, fileCache, fileKey } from './fileCache';

/** Cache Storage in memory, enough for fileCache. */
function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  return {
    stores,
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        match: async (key: string) => store.get(key)?.clone(),
        put: async (key: string, res: Response) => void store.set(key, res),
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('fileKey', () => {
  it('keeps PDFs by their hashed names and attachments by content hash only', () => {
    expect(fileKey('results/p1/blk-a-1234abcd.pdf')).toBe('results/p1/blk-a-1234abcd.pdf');
    expect(fileKey('results/p1/references-0f0f0f0f.pdf')).toBe('results/p1/references-0f0f0f0f.pdf');
    expect(fileKey('results/p1/files/fig-1234abcd.pdf')).toBeNull();
    expect(fileKey('results/p1/files/fig.png', 'abc')).toBe('results/p1/files/fig.png#abc');
    expect(fileKey('results.json')).toBeNull();
  });
});

describe('fileCache', () => {
  it("keeps an account's files until someone signs out", async () => {
    const storage = fakeCaches();
    vi.stubGlobal('caches', storage);
    const data = new Uint8Array([1, 2]);
    const alice = fileCache('Alice');
    alice.remember('results/p1/blk-a-1234abcd.pdf', data);
    alice.remember('results/p1/files/fig.png', data);
    await vi.waitFor(() => expect(storage.stores.get('results-files-v1-alice')?.size).toBe(1));
    expect(await fileCache('alice').read('results/p1/blk-a-1234abcd.pdf')).toEqual(data);
    expect(await fileCache('bob').read('results/p1/blk-a-1234abcd.pdf')).toBeNull();
    await clearFileCaches();
    expect(await fileCache('alice').read('results/p1/blk-a-1234abcd.pdf')).toBeNull();
  });

  it('works without Cache Storage, keeping nothing', async () => {
    const cache = fileCache('alice');
    cache.remember('results/p1/blk-a-1234abcd.pdf', new Uint8Array([1]));
    expect(await cache.read('results/p1/blk-a-1234abcd.pdf')).toBeNull();
    await expect(clearFileCaches()).resolves.toBeUndefined();
  });
});
