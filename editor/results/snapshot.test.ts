import { describe, expect, it } from 'vitest';
import { ResultPaper } from '../../types';
import { buildSnapshot, hasPublished, isEmptyPlan, planPublicSync, snapshotText } from './snapshot';

const output = (pdf: string) => ({ pdf, width: 400, height: 120, inputHash: 'secret-hash', counters: { table: 1 }, labels: { 'tab:a': '{1}{1}' } });

const papers: ResultPaper[] = [
  {
    id: 'p1',
    slug: 'public-paper',
    title: 'A published paper',
    authors: ['**Me**', 'You'],
    venue: 'Made-up Conf 2027',
    year: 2027,
    preamble: '\\documentclass{article} % private macros',
    files: ['style.sty'],
    blocks: [
      { id: 'b1', kind: 'table', source: '% unpublished: 99.9', output: output('results/p1/b1-aaaa.pdf') },
      { id: 'b2', kind: 'text', source: 'secret ablation', hidden: true, output: output('results/p1/b2-bbbb.pdf') },
      { id: 'b3', kind: 'figure', source: 'not compiled yet' },
    ],
  },
  {
    id: 'p2',
    slug: 'private-paper',
    title: 'An unpublished paper',
    authors: [],
    hidden: true,
    blocks: [{ id: 'b4', kind: 'table', source: 'x', output: output('results/p2/b4-cccc.pdf') }],
  },
];

describe('buildSnapshot', () => {
  it('keeps published papers and their visible compiled blocks, without sources or bookkeeping', () => {
    expect(buildSnapshot(papers)).toEqual([
      {
        id: 'p1',
        slug: 'public-paper',
        title: 'A published paper',
        authors: ['**Me**', 'You'],
        venue: 'Made-up Conf 2027',
        year: 2027,
        blocks: [{ id: 'b1', kind: 'table', output: { pdf: 'results/p1/b1-aaaa.pdf', width: 400, height: 120 } }],
      },
    ]);
  });

  it('never mentions private text', () => {
    const text = snapshotText(papers);
    for (const secret of ['unpublished', 'secret', 'private macros', 'style.sty', 'An unpublished paper', 'secret-hash', 'tab:a']) {
      expect(text).not.toContain(secret);
    }
  });
});

describe('hasPublished', () => {
  it('tells whether any paper is public', () => {
    expect(hasPublished(papers)).toBe(true);
    expect(hasPublished([papers[1]])).toBe(false);
  });
});

describe('planPublicSync', () => {
  it('adds missing files, removes stale ones and rewrites a changed snapshot', () => {
    const plan = planPublicSync(papers, '[]\n', ['public/results/p1/b1-old.pdf', 'public/results/p2/b4-cccc.pdf']);
    expect(plan.json).toBe(snapshotText(papers));
    expect(plan.add).toEqual(['results/p1/b1-aaaa.pdf']);
    expect(plan.remove).toEqual(['public/results/p1/b1-old.pdf', 'public/results/p2/b4-cccc.pdf']);
  });

  it('plans nothing when the site already matches', () => {
    const plan = planPublicSync(papers, snapshotText(papers), ['public/results/p1/b1-aaaa.pdf']);
    expect(isEmptyPlan(plan)).toBe(true);
  });

  it('empties the site when nothing is published', () => {
    const plan = planPublicSync([papers[1]], snapshotText(papers), ['public/results/p1/b1-aaaa.pdf']);
    expect(plan.json).toBe('[]\n');
    expect(plan.add).toEqual([]);
    expect(plan.remove).toEqual(['public/results/p1/b1-aaaa.pdf']);
  });
});
