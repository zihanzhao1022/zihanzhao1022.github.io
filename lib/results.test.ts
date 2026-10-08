import { describe, expect, it } from 'vitest';
import { ResultBlock, ResultPaper } from '../types';
import { findPaper, paperPath, publicFilePath, shownBlocks } from './results';

const paper = (id: string, slug: string): ResultPaper => ({ id, slug, title: id, authors: [], blocks: [] });

describe('findPaper', () => {
  it('finds a paper by its address', () => {
    const papers = [paper('a', 'alpha'), paper('b', 'beta')];
    expect(findPaper(papers, 'beta')?.id).toBe('b');
    expect(findPaper(papers, 'gamma')).toBeUndefined();
    expect(findPaper(papers, undefined)).toBeUndefined();
  });
});

describe('paths', () => {
  it('builds the page route and the address of published files', () => {
    expect(paperPath({ slug: 'alpha' })).toBe('/results/alpha');
    expect(publicFilePath('results/res-a/blk-b-1234.pdf')).toBe('/results/res-a/blk-b-1234.pdf');
  });
});

describe('shownBlocks', () => {
  const blocks: ResultBlock[] = [
    { id: 'b1', kind: 'text' },
    { id: 'b2', kind: 'table', hidden: true },
  ];

  it('drops hidden blocks for visitors and keeps them while editing', () => {
    expect(shownBlocks(blocks, false).map((block) => block.id)).toEqual(['b1']);
    expect(shownBlocks(blocks, true).map((block) => block.id)).toEqual(['b1', 'b2']);
  });
});
