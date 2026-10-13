import { describe, expect, it } from 'vitest';
import { ATTACHMENT_LIMIT } from './actions';
import { MAX_UPLOAD, planUpload } from './uploads';

const picked = (path: string, size = 10) => ({ path, file: new File([new Uint8Array(size)], path.split('/').pop()!) });

describe('planUpload', () => {
  it('names the files with their folders, notes what they replace and leaves out what compiles cannot use', async () => {
    const plan = await planUpload(
      [picked('figs/a.pdf'), picked('figs/sub/b.png'), picked('refs.bib'), picked('figs/notes.svg'), picked('run.py'), picked('big.pdf', ATTACHMENT_LIMIT + 1)],
      ['refs.bib', 'figs/a.pdf', 'other.sty'],
    );
    expect(Object.keys(plan.files)).toEqual(['figs/a.pdf', 'figs/sub/b.png', 'refs.bib']);
    expect(plan.files['figs/a.pdf']).toHaveLength(10);
    expect(plan.replaced).toEqual(['figs/a.pdf', 'refs.bib']);
    expect(plan.skipped).toEqual({ type: ['figs/notes.svg', 'run.py'], size: ['big.pdf'], count: [] });
  });

  it(`takes at most ${MAX_UPLOAD} files at once`, async () => {
    const many = Array.from({ length: MAX_UPLOAD + 2 }, (_, index) => picked(`f${index}.pdf`));
    const plan = await planUpload(many, []);
    expect(Object.keys(plan.files)).toHaveLength(MAX_UPLOAD);
    expect(plan.skipped.count).toEqual([`f${MAX_UPLOAD}.pdf`, `f${MAX_UPLOAD + 1}.pdf`]);
  });
});
