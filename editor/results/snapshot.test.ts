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

  it("keeps a published paper as the site shows it while collaborators' edits wait for review", () => {
    const onSite = snapshotText(papers);
    const edited: ResultPaper = {
      ...papers[0],
      title: 'Retitled by a collaborator',
      blocks: [{ id: 'b1', kind: 'table', source: '% new numbers', output: output('results/p1/b1-dddd.pdf') }],
      pendingReview: ['alice'],
    };
    const plan = planPublicSync([edited, papers[1]], onSite, ['public/results/p1/b1-aaaa.pdf']);
    expect(isEmptyPlan(plan)).toBe(true);
    // Once the owner publishes the edits, the site follows.
    const approved = planPublicSync([{ ...edited, pendingReview: undefined }, papers[1]], onSite, ['public/results/p1/b1-aaaa.pdf']);
    expect(approved.json).toContain('Retitled by a collaborator');
    expect(approved.add).toEqual(['results/p1/b1-dddd.pdf']);
    expect(approved.remove).toEqual(['public/results/p1/b1-aaaa.pdf']);
  });

  it('leaves a paper with edits waiting for review off the site if the site does not show it yet', () => {
    const plan = planPublicSync([{ ...papers[0], pendingReview: ['alice'] }], '[]\n', []);
    expect(isEmptyPlan(plan)).toBe(true);
  });

  it("copies files only for papers built from the private list, never from what the site's file names", () => {
    // A site file that (somehow) names a hidden paper's PDF must not make the sync copy it.
    const tampered = JSON.stringify([{ id: 'p1', slug: 'x', title: 'x', authors: [], blocks: [{ id: 'b4', kind: 'table', output: output('results/p2/b4-cccc.pdf') }] }]);
    const plan = planPublicSync([{ ...papers[0], pendingReview: ['alice'] }, papers[1]], tampered, []);
    expect(plan.add).toEqual([]);
  });

  it('publishes the typeset References with the paper, without its citation bookkeeping', () => {
    const withRefs: ResultPaper = { ...papers[0], references: { pdf: 'results/p1/references-cccc.pdf', width: 400, height: 60, inputHash: 'h', citations: { a: '{1}' } } };
    const [shown] = buildSnapshot([withRefs]);
    expect(shown.references).toEqual({ pdf: 'results/p1/references-cccc.pdf', width: 400, height: 60 });
    expect(planPublicSync([withRefs], '[]\n', []).add).toContain('results/p1/references-cccc.pdf');
  });

  it('empties the site when nothing is published', () => {
    const plan = planPublicSync([papers[1]], snapshotText(papers), ['public/results/p1/b1-aaaa.pdf']);
    expect(plan.json).toBe('[]\n');
    expect(plan.add).toEqual([]);
    expect(plan.remove).toEqual(['public/results/p1/b1-aaaa.pdf']);
  });
});
