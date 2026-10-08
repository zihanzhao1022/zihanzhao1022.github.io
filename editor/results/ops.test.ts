import { describe, expect, it } from 'vitest';
import { ResultBlock, ResultPaper } from '../../types';
import { applyResultsOp, fromContentOp, referencedPaths, resultsCommitMessage, touchedPapers } from './ops';

const block = (id: string, extra: Partial<ResultBlock> = {}): ResultBlock => ({ id, kind: 'table', source: `% ${id}`, ...extra });

const paper = (id: string, extra: Partial<ResultPaper> = {}): ResultPaper => ({
  id,
  slug: id,
  title: `Paper ${id}`,
  authors: ['A. Author'],
  preamble: '\\documentclass{article}',
  files: ['style.sty'],
  blocks: [block('b1'), block('b2')],
  ...extra,
});

describe('applyResultsOp', () => {
  it('puts a new paper first', () => {
    const papers = applyResultsOp([paper('p1')], { kind: 'putPaper', paper: paper('p2', { hidden: true }) });
    expect(papers.map((item) => item.id)).toEqual(['p2', 'p1']);
    expect(papers[0].hidden).toBe(true);
  });

  it('updates only the information fields of an existing paper', () => {
    const latest = paper('p1', { venue: 'Old venue', blocks: [block('b1'), block('b2'), block('b3')], hidden: true });
    // The form's copy is older: it lacks block b3 and still has the old preamble.
    const form = paper('p1', { title: 'New title', summary: 'Short', preamble: 'stale', blocks: [], hidden: false });
    const [updated] = applyResultsOp([latest], { kind: 'putPaper', paper: form });
    expect(updated.title).toBe('New title');
    expect(updated.summary).toBe('Short');
    expect(updated).not.toHaveProperty('venue');
    expect(updated.blocks.map((item) => item.id)).toEqual(['b1', 'b2', 'b3']);
    expect(updated.preamble).toBe('\\documentclass{article}');
    expect(updated.hidden).toBe(true);
  });

  it('updates who a paper is shared with through the paper form', () => {
    const latest = paper('p1', { viewers: ['alice'], editors: ['bob'] });
    const [updated] = applyResultsOp([latest], { kind: 'putPaper', paper: paper('p1', { viewers: ['carol'] }) });
    expect(updated.viewers).toEqual(['carol']);
    expect(updated).not.toHaveProperty('editors');
  });

  it("keeps collaborators' edits to a published paper waiting until the owner publishes them", () => {
    const published = paper('p1', { hidden: false });
    const noted = applyResultsOp([published], { kind: 'noteEdit', paperId: 'p1', login: 'alice' });
    expect(noted[0].pendingReview).toEqual(['alice']);
    const twice = applyResultsOp(noted, { kind: 'batch', ops: [{ kind: 'noteEdit', paperId: 'p1', login: 'ALICE' }, { kind: 'noteEdit', paperId: 'p1', login: 'bob' }] });
    expect(twice[0].pendingReview).toEqual(['alice', 'bob']);
    expect(applyResultsOp(twice, { kind: 'approveEdits', id: 'p1' })[0]).not.toHaveProperty('pendingReview');
    // Hidden papers are not on the site, and publishing one publishes all of it.
    expect(applyResultsOp([paper('p2', { hidden: true })], { kind: 'noteEdit', paperId: 'p2', login: 'alice' })[0]).not.toHaveProperty('pendingReview');
    const hidden = applyResultsOp(twice, { kind: 'setPaperHidden', id: 'p1', hidden: true });
    expect(hidden[0].pendingReview).toEqual(['alice', 'bob']);
    expect(applyResultsOp(hidden, { kind: 'setPaperHidden', id: 'p1', hidden: false })[0]).not.toHaveProperty('pendingReview');
  });

  it('sets and drops the typeset bibliography, whose PDF counts as in use', () => {
    const references = { pdf: 'results/p1/references-aaaa.pdf', width: 400, height: 90, inputHash: 'h', citations: { a: '{1}' } };
    const [withRefs] = applyResultsOp([paper('p1')], { kind: 'setReferences', paperId: 'p1', references });
    expect(withRefs.references).toEqual(references);
    expect(referencedPaths([withRefs]).has(references.pdf)).toBe(true);
    expect(applyResultsOp([withRefs], { kind: 'setReferences', paperId: 'p1', references: null })[0]).not.toHaveProperty('references');
  });

  it('deletes, reorders and hides papers', () => {
    const papers = [paper('p1'), paper('p2'), paper('p3')];
    expect(applyResultsOp(papers, { kind: 'deletePaper', id: 'p2' }).map((item) => item.id)).toEqual(['p1', 'p3']);
    expect(applyResultsOp(papers, { kind: 'reorderPapers', ids: ['p3', 'p1'] }).map((item) => item.id)).toEqual([
      'p3',
      'p2',
      'p1',
    ]);
    const hidden = applyResultsOp(papers, { kind: 'setPaperHidden', id: 'p1', hidden: true });
    expect(hidden[0].hidden).toBe(true);
    expect(applyResultsOp(hidden, { kind: 'setPaperHidden', id: 'p1', hidden: false })[0]).not.toHaveProperty('hidden');
  });

  it('patches the preamble', () => {
    const [updated] = applyResultsOp([paper('p1')], { kind: 'patchPaper', id: 'p1', fields: { preamble: '\\documentclass{report}' } });
    expect(updated.preamble).toBe('\\documentclass{report}');
    expect(updated.files).toEqual(['style.sty']);
  });

  it('adds, replaces and removes attachments one at a time', () => {
    let papers = applyResultsOp([paper('p1')], { kind: 'putFile', paperId: 'p1', name: 'fig.pdf', hash: 'h1' });
    expect(papers[0].files).toEqual(['style.sty', 'fig.pdf']);
    papers = applyResultsOp(papers, { kind: 'putFile', paperId: 'p1', name: 'fig.pdf', hash: 'h2' });
    expect(papers[0].files).toEqual(['style.sty', 'fig.pdf']);
    expect(papers[0].fileHashes).toEqual({ 'fig.pdf': 'h2' });
    papers = applyResultsOp(papers, { kind: 'removeFile', paperId: 'p1', name: 'fig.pdf' });
    expect(papers[0].files).toEqual(['style.sty']);
    expect(papers[0].fileHashes).toEqual({});
  });

  it('changes only the kind and source of an existing block, or inserts a new one at a position', () => {
    const output = { pdf: 'results/p1/b2-aaaa.pdf', width: 1, height: 1 };
    const latest = [paper('p1', { blocks: [block('b1'), block('b2', { hidden: true, output })] })];
    // The edit was made on a page that still showed b2 as visible and without its output.
    const replaced = applyResultsOp(latest, { kind: 'putBlock', paperId: 'p1', block: block('b2', { source: 'new' }) });
    expect(replaced[0].blocks.map((item) => item.source)).toEqual(['% b1', 'new']);
    expect(replaced[0].blocks[1]).toMatchObject({ hidden: true, output });
    const appended = applyResultsOp([paper('p1')], { kind: 'putBlock', paperId: 'p1', block: block('b9') });
    expect(appended[0].blocks.map((item) => item.id)).toEqual(['b1', 'b2', 'b9']);
    const inserted = applyResultsOp([paper('p1')], { kind: 'putBlock', paperId: 'p1', block: block('b0'), at: 0 });
    expect(inserted[0].blocks.map((item) => item.id)).toEqual(['b0', 'b1', 'b2']);
    const clamped = applyResultsOp([paper('p1')], { kind: 'putBlock', paperId: 'p1', block: block('bx'), at: 99 });
    expect(clamped[0].blocks.map((item) => item.id)).toEqual(['b1', 'b2', 'bx']);
  });

  it('deletes, reorders and hides blocks, leaving other papers alone', () => {
    const papers = [paper('p1'), paper('p2')];
    const deleted = applyResultsOp(papers, { kind: 'deleteBlock', paperId: 'p1', blockId: 'b1' });
    expect(deleted[0].blocks.map((item) => item.id)).toEqual(['b2']);
    expect(deleted[1]).toBe(papers[1]);
    const reordered = applyResultsOp(papers, { kind: 'reorderBlocks', paperId: 'p1', ids: ['b2', 'b1'] });
    expect(reordered[0].blocks.map((item) => item.id)).toEqual(['b2', 'b1']);
    const hidden = applyResultsOp(papers, { kind: 'setBlockHidden', paperId: 'p1', blockId: 'b2', hidden: true });
    expect(hidden[0].blocks[1].hidden).toBe(true);
  });

  it('sets compiled outputs of existing blocks whose source is unchanged', () => {
    const output = { pdf: 'results/p1/b1-aaaa.pdf', width: 300, height: 100, inputHash: 'h' };
    const [updated] = applyResultsOp([paper('p1')], {
      kind: 'setOutputs',
      paperId: 'p1',
      outputs: { b1: output, b2: output, gone: output },
      // b2 was edited elsewhere after this output was compiled from its old text.
      sources: { b1: '% b1', b2: 'old text', gone: '' },
    });
    expect(updated.blocks[0].output).toEqual(output);
    expect(updated.blocks[1].output).toBeUndefined();
    expect(updated.blocks.map((item) => item.id)).toEqual(['b1', 'b2']);
  });

  it('applies a batch in order', () => {
    const papers = applyResultsOp([paper('p1')], {
      kind: 'batch',
      ops: [
        { kind: 'putBlock', paperId: 'p1', block: block('b3') },
        { kind: 'reorderBlocks', paperId: 'p1', ids: ['b3', 'b1', 'b2'] },
      ],
    });
    expect(papers[0].blocks.map((item) => item.id)).toEqual(['b3', 'b1', 'b2']);
  });
});

describe('touchedPapers', () => {
  it('names the papers an operation changes', () => {
    expect(touchedPapers({ kind: 'putPaper', paper: paper('p1') })).toEqual(['p1']);
    expect(touchedPapers({ kind: 'reorderPapers', ids: ['p1', 'p2'] })).toEqual([]);
    expect(
      touchedPapers({
        kind: 'batch',
        ops: [
          { kind: 'putBlock', paperId: 'p1', block: block('b1') },
          { kind: 'setOutputs', paperId: 'p1', outputs: {}, sources: {} },
          { kind: 'setPaperHidden', id: 'p2', hidden: true },
        ],
      }),
    ).toEqual(['p1', 'p2']);
  });
});

describe('referencedPaths', () => {
  it('lists the PDFs and attachments the papers use', () => {
    const output = { pdf: 'results/p1/b1-aaaa.pdf', width: 1, height: 1 };
    expect([...referencedPaths([paper('p1', { blocks: [block('b1', { output })] })])]).toEqual([
      'results/p1/b1-aaaa.pdf',
      'results/p1/files/style.sty',
    ]);
  });
});

describe('fromContentOp', () => {
  it('turns the generic list operations into results operations', () => {
    const item = { ...paper('p1') } as unknown as { id: string } & Record<string, unknown>;
    expect(fromContentOp({ kind: 'upsert', collection: 'results', item })).toEqual({ kind: 'putPaper', paper: item });
    expect(fromContentOp({ kind: 'delete', collection: 'results', id: 'p1' })).toEqual({ kind: 'deletePaper', id: 'p1' });
    expect(fromContentOp({ kind: 'reorder', collection: 'results', ids: ['p2'] })).toEqual({ kind: 'reorderPapers', ids: ['p2'] });
    expect(fromContentOp({ kind: 'setHidden', collection: 'results', id: 'p1', hidden: false })).toEqual({
      kind: 'setPaperHidden',
      id: 'p1',
      hidden: false,
    });
    expect(fromContentOp({ kind: 'patchProfile', collection: 'profile', fields: {} })).toBeNull();
  });
});

describe('resultsCommitMessage', () => {
  it('names the action and a shortened title', () => {
    expect(resultsCommitMessage('add paper', 'Made-up results')).toBe('results: add paper "Made-up results"');
    expect(resultsCommitMessage('reorder papers')).toBe('results: reorder papers');
    expect(resultsCommitMessage('update', 'x'.repeat(80))).toBe(`results: update "${'x'.repeat(57)}..."`);
  });
});
