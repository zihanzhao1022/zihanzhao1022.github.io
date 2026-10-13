import { describe, expect, it } from 'vitest';
import { DropEntry, MAX_ENTRIES, TooManyFiles, filesOfEntries, isJunk } from './droppedFiles';

const file = (name: string): DropEntry => ({
  name,
  isFile: true,
  isDirectory: false,
  file: (success) => success(new File([`made-up ${name}`], name)),
});

// A folder whose reader hands its entries over in batches of two, then an empty batch.
const folder = (name: string, entries: DropEntry[]): DropEntry => ({
  name,
  isFile: false,
  isDirectory: true,
  createReader: () => {
    let at = 0;
    return {
      readEntries: (success) => {
        success(entries.slice(at, at + 2));
        at += 2;
      },
    };
  },
});

describe('filesOfEntries', () => {
  it('reads dropped folders through, keeping their paths and leaving out hidden files and caches', async () => {
    const dropped = [
      folder('figs', [file('a.pdf'), file('.DS_Store'), folder('sub', [file('b.png')]), folder('__pycache__', [file('c.pyc')]), file('d.pdf')]),
      file('refs.bib'),
    ];
    const picked = await filesOfEntries(dropped);
    expect(picked.map((item) => item.path)).toEqual(['figs/a.pdf', 'figs/sub/b.png', 'figs/d.pdf', 'refs.bib']);
    expect(picked[0].file.name).toBe('a.pdf');
  });

  it('stops at a drop too large to be a paper', async () => {
    const many = folder('everything', Array.from({ length: MAX_ENTRIES + 1 }, (_, index) => file(`f${index}.pdf`)));
    await expect(filesOfEntries([many])).rejects.toBeInstanceOf(TooManyFiles);
  });
});

describe('isJunk', () => {
  it('spots hidden files and folders and caches anywhere in a path', () => {
    expect(isJunk('figs/.DS_Store')).toBe(true);
    expect(isJunk('.git/config')).toBe(true);
    expect(isJunk('paper/__MACOSX/figs/a.pdf')).toBe(true);
    expect(isJunk('figs/v1.2/a.pdf')).toBe(false);
  });
});
