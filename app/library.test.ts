import { describe, expect, it } from 'vitest';
import { ResultPaper } from '../types';
import { copyPaper, newPaper, sharing, uniqueSlug, withSharing } from './library';

describe('uniqueSlug', () => {
  it('makes a slug from the title that the account does not use yet', () => {
    expect(uniqueSlug('Made-up Results: Part 1', [], 'res-x')).toBe('made-up-results-part-1');
    expect(uniqueSlug('Made-up', ['made-up', 'made-up-2'], 'res-x')).toBe('made-up-3');
    expect(uniqueSlug('结果', [], 'res-x')).toBe('res-x');
  });
});

describe('newPaper', () => {
  it('starts private, with the author and no blocks', () => {
    const paper = newPaper({ title: ' Made-up paper ', venue: 'Made-up Conf', year: 2027 }, 'Made Up', [], 0);
    expect(paper).toMatchObject({ id: 'res-0', slug: 'made-up-paper', title: 'Made-up paper', authors: ['**Made Up**'], venue: 'Made-up Conf', year: 2027, hidden: true, blocks: [], files: [] });
  });
});

describe('copyPaper', () => {
  it('moves the PDFs and attachments to the new id, kept versions and bibliography included', () => {
    const out = (pdf: string) => ({ pdf, width: 1, height: 1 });
    const paper: ResultPaper = {
      id: 'res-a',
      slug: 'a',
      title: 'A',
      authors: [],
      files: ['figs/plot.pdf'],
      references: { ...out('results/res-a/references-1.pdf') },
      blocks: [{ id: 'b', kind: 'figure', source: 'x', output: out('results/res-a/b-1.pdf'), alternate: { kind: 'table', source: 'y', output: out('results/res-a/b-2.pdf') } }],
    };
    const read = (path: string) => new TextEncoder().encode(path);
    const copied = copyPaper(paper, read, 'res-b', { title: 'B' });
    expect(copied.paper).toMatchObject({ id: 'res-b', title: 'B', references: { pdf: 'results/res-b/references-1.pdf' } });
    expect(copied.paper.blocks[0].output?.pdf).toBe('results/res-b/b-1.pdf');
    expect(copied.paper.blocks[0].alternate?.output?.pdf).toBe('results/res-b/b-2.pdf');
    expect([...copied.files.keys()].sort()).toEqual([
      'results/res-b/b-1.pdf',
      'results/res-b/b-2.pdf',
      'results/res-b/files/figs/plot.pdf',
      'results/res-b/references-1.pdf',
    ]);
    expect(new TextDecoder().decode(copied.files.get('results/res-b/b-1.pdf'))).toBe('results/res-a/b-1.pdf');
  });
});

describe('sharing', () => {
  it('reads and writes who a paper is shared with', () => {
    const paper = { id: 'p', slug: 'p', title: 'P', authors: [], blocks: [], viewers: ['alice'] } as ResultPaper;
    expect(sharing(paper)).toEqual([{ login: 'alice', role: 'viewer' }]);
    const next = withSharing(paper, [{ login: 'alice', role: 'editor' }, { login: 'bob', role: 'viewer' }]);
    expect(next).toMatchObject({ editors: ['alice'], viewers: ['bob'] });
    expect(withSharing(next, [])).not.toHaveProperty('viewers');
  });
});
