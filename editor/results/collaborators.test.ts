import { describe, expect, it } from 'vitest';
import { ResultBlock, ResultPaper } from '../../types';
import { canReadFile, checkEditorOp, cleanOutput, hasAnyRole, isPaperPath, papersFor, parseAccess, roleOf } from './collaborators';

const output = (paperId: string, blockId: string) => ({ pdf: `results/${paperId}/${blockId}-0123abcd.pdf`, width: 300, height: 100 });

const block = (id: string, extra: Partial<ResultBlock> = {}): ResultBlock => ({
  id,
  kind: 'table',
  source: `\\begin{table}${id}\\end{table}`,
  output: output('res-a', id),
  ...extra,
});

const paper = (id: string, extra: Partial<ResultPaper> = {}): ResultPaper => ({
  id,
  slug: id,
  title: `Paper ${id}`,
  authors: ['A'],
  hidden: true,
  preamble: '\\documentclass{article}',
  files: ['style.sty'],
  fileHashes: { 'style.sty': 'abc123' },
  blocks: [block('blk-1'), block('blk-2', { hidden: true }), block('blk-3', { output: undefined })],
  ...extra,
});

const ids = { alice: 101, bob: 102, carol: 103 };
const alice = { login: 'alice', id: 101 };
const bob = { login: 'Bob', id: 102 };

describe('roles', () => {
  const shared = paper('res-a', { viewers: ['@Alice', 'bob'], editors: ['BOB', 'carol'], collaboratorIds: ids });

  it('matches GitHub user names without case or "@", editors before viewers', () => {
    expect(roleOf(shared, { login: 'ALICE', id: 101 })).toBe('viewer');
    expect(roleOf(shared, bob)).toBe('editor');
    expect(roleOf(shared, { login: 'carol', id: 103 })).toBe('editor');
    expect(roleOf(shared, { login: 'dave', id: 104 })).toBeNull();
    expect(roleOf(shared, { login: '', id: 101 })).toBeNull();
    expect(roleOf(paper('res-b'), alice)).toBeNull();
  });

  it('refuses another account that has taken a listed user name', () => {
    expect(roleOf(shared, { login: 'alice', id: 999 })).toBeNull();
    expect(roleOf(paper('res-b', { viewers: ['alice'] }), alice)).toBeNull();
  });

  it('says whether someone is on any list', () => {
    expect(hasAnyRole([paper('res-b'), shared], alice)).toBe(true);
    expect(hasAnyRole([paper('res-b'), shared], { login: 'dave', id: 104 })).toBe(false);
  });
});

describe('papersFor', () => {
  const papers = [
    paper('res-a', { viewers: ['alice'], editors: ['bob'], collaboratorIds: ids }),
    paper('res-b', { editors: ['alice'], hidden: false, collaboratorIds: ids, pendingReview: ['carol'] }),
    paper('res-c', { hidden: false }),
  ];

  it("gives viewers only the visible compiled blocks, like the site's snapshot", () => {
    const view = papersFor(papers, alice);
    expect(view.roles).toEqual({ 'res-a': 'viewer', 'res-b': 'editor' });
    expect(view.papers.map((item) => item.id)).toEqual(['res-a', 'res-b']);
    const [viewed] = view.papers;
    expect(viewed.hidden).toBe(true);
    expect(viewed.blocks).toEqual([{ id: 'blk-1', kind: 'table', output: output('res-a', 'blk-1') }]);
    for (const key of ['preamble', 'files', 'fileHashes', 'viewers', 'editors', 'collaboratorIds']) expect(viewed).not.toHaveProperty(key);
  });

  it('gives editors the whole paper except who it is shared with', () => {
    const [edited] = papersFor(papers, bob).papers;
    const { viewers: _viewers, editors: _editors, collaboratorIds: _ids, ...rest } = papers[0];
    expect(edited).toEqual(rest);
    const [, other] = papersFor(papers, alice).papers;
    expect(other).not.toHaveProperty('pendingReview');
  });

  it('gives nothing to people on no list', () => {
    expect(papersFor(papers, { login: 'dave', id: 104 })).toEqual({ papers: [], roles: {} });
  });
});

describe('files', () => {
  const shared = paper('res-a');

  it('only accepts plain files of the paper folder', () => {
    expect(isPaperPath('res-a', 'results/res-a/blk-1-0123abcd.pdf')).toBe(true);
    expect(isPaperPath('res-a', 'results/res-a/files/style.sty')).toBe(true);
    for (const path of [
      'results/res-b/blk-1.pdf',
      'results/res-a/../res-b/blk-1.pdf',
      'results/res-a/files/../../res-b/x.pdf',
      'results/res-a/files/sub/x.pdf',
      'results/res-a/..',
      'results/res-a/.hidden',
      'results/res-a/files',
      'results/res-a/blk-1',
      'results.json',
      '/results/res-a/x.pdf',
      'public/results/res-a/x.pdf',
    ]) {
      expect(isPaperPath('res-a', path)).toBe(false);
    }
  });

  it('lets editors read any file of the paper and viewers only visible PDFs', () => {
    expect(canReadFile(shared, 'editor', 'results/res-a/files/style.sty')).toBe(true);
    expect(canReadFile(shared, 'editor', 'results/res-a/blk-2-0123abcd.pdf')).toBe(true);
    expect(canReadFile(shared, 'viewer', 'results/res-a/blk-1-0123abcd.pdf')).toBe(true);
    expect(canReadFile(shared, 'viewer', 'results/res-a/blk-2-0123abcd.pdf')).toBe(false);
    expect(canReadFile(shared, 'viewer', 'results/res-a/files/style.sty')).toBe(false);
    expect(canReadFile(shared, 'editor', 'results/res-b/blk-1-0123abcd.pdf')).toBe(false);
  });
});

describe('checkEditorOp', () => {
  const allowed = (op: unknown) => {
    const checked = checkEditorOp(op, 'res-a');
    if ('error' in checked) throw new Error(checked.error);
    return checked.op;
  };
  const refused = (op: unknown) => expect(checkEditorOp(op, 'res-a')).toHaveProperty('error');

  it('accepts edits to blocks, outputs, the preamble and attachments of the shared paper', () => {
    const ops = [
      { kind: 'putBlock', paperId: 'res-a', block: { id: 'blk-9', kind: 'text', source: 'Hi' }, at: 1 },
      { kind: 'deleteBlock', paperId: 'res-a', blockId: 'blk-1' },
      { kind: 'setBlockHidden', paperId: 'res-a', blockId: 'blk-1', hidden: true },
      { kind: 'reorderBlocks', paperId: 'res-a', ids: ['blk-2', 'blk-1'] },
      { kind: 'putFile', paperId: 'res-a', name: 'plot.pdf', hash: '0123456789abcdef' },
      { kind: 'removeFile', paperId: 'res-a', name: '_old.sty' },
      { kind: 'patchPaper', id: 'res-a', fields: { preamble: '\\documentclass{report}' } },
      {
        kind: 'setOutputs',
        paperId: 'res-a',
        outputs: { 'blk-1': { ...output('res-a', 'blk-1'), inputHash: '00aa', counters: { table: 2 }, labels: { 'tab:x': '{1}{1}' } } },
        sources: { 'blk-1': 'src' },
      },
    ];
    for (const op of ops) expect(allowed(op)).toEqual(op);
    expect(allowed({ kind: 'batch', ops })).toEqual({ kind: 'batch', ops });
  });

  it('rebuilds each operation from checked fields only', () => {
    expect(
      allowed({
        kind: 'putBlock',
        paperId: 'res-a',
        block: { id: 'blk-9', kind: 'table', source: 'x', hidden: true, output: output('res-b', 'blk-9'), extra: 1 },
        sneaky: true,
      }),
    ).toEqual({ kind: 'putBlock', paperId: 'res-a', block: { id: 'blk-9', kind: 'table', source: 'x', hidden: true } });
    expect(allowed({ kind: 'deleteBlock', paperId: 'res-a', blockId: 'blk-1', id: 'res-b' })).toEqual({
      kind: 'deleteBlock',
      paperId: 'res-a',
      blockId: 'blk-1',
    });
  });

  it('refuses edits to other papers', () => {
    refused({ kind: 'putBlock', paperId: 'res-b', block: { id: 'blk-9', kind: 'text', source: 'x' } });
    refused({ kind: 'deleteBlock', paperId: 'res-b', blockId: 'blk-1' });
    refused({ kind: 'patchPaper', id: 'res-b', fields: { preamble: 'x' } });
    refused({ kind: 'batch', ops: [{ kind: 'deleteBlock', paperId: 'res-a', blockId: 'blk-1' }, { kind: 'deleteBlock', paperId: 'res-b', blockId: 'blk-1' }] });
  });

  it("refuses what only the owner may do", () => {
    refused({ kind: 'putPaper', paper: paper('res-a', { editors: ['mallory'] }) });
    refused({ kind: 'approveEdits', id: 'res-a' });
    refused({ kind: 'noteEdit', paperId: 'res-a', login: 'someone-else' });
    refused({ kind: 'setPaperHidden', id: 'res-a', hidden: false });
    refused({ kind: 'deletePaper', id: 'res-a' });
    refused({ kind: 'reorderPapers', ids: ['res-a'] });
    refused({ kind: 'patchPaper', id: 'res-a', fields: { preamble: 'x', editors: ['mallory'] } });
    refused({ kind: 'patchPaper', id: 'res-a', fields: { hidden: false } });
  });

  it('refuses malformed operations', () => {
    for (const op of [
      null,
      'putBlock',
      [],
      { kind: 'reorderBlocks', paperId: 'res-a', ids: 'blk-1' },
      { kind: 'reorderBlocks', paperId: 'res-a', ids: [{ id: 'blk-1' }] },
      { kind: 'deleteBlock', paperId: 'res-a', blockId: '../x' },
      { kind: 'setBlockHidden', paperId: 'res-a', blockId: 'blk-1', hidden: 'yes' },
      { kind: 'putBlock', paperId: 'res-a', block: { id: 'blk-9', kind: 'video', source: 'x' } },
      { kind: 'putBlock', paperId: 'res-a', block: { id: 'blk-9', kind: 'text' } },
      { kind: 'putBlock', paperId: 'res-a', block: { id: 'blk-9', kind: 'text', source: 'x'.repeat(200_001) } },
      { kind: 'putFile', paperId: 'res-a', name: '../results.json', hash: 'abc' },
      { kind: 'putFile', paperId: 'res-a', name: 'a.sty', hash: { x: 1 } },
      { kind: 'removeFile', paperId: 'res-a', name: 'sub/a.sty' },
      { kind: 'patchPaper', id: 'res-a', fields: { preamble: 42 } },
      { kind: 'batch', ops: [] },
      { kind: 'batch', ops: [{ kind: 'batch', ops: [{ kind: 'deleteBlock', paperId: 'res-a', blockId: 'blk-1' }] }] },
      { kind: 'setOutputs', paperId: 'res-a', outputs: { 'blk-1': output('res-a', 'blk-1') }, sources: {} },
      { kind: 'setOutputs', paperId: 'res-a', outputs: { 'blk-1': output('res-b', 'blk-1') }, sources: { 'blk-1': 'x' } },
      {
        kind: 'setOutputs',
        paperId: 'res-a',
        outputs: { 'blk-1': { ...output('res-a', 'blk-1'), pdf: 'results/res-a/files/plot.pdf' } },
        sources: { 'blk-1': 'x' },
      },
      // As the Worker gets it: JSON.parse makes "__proto__" an ordinary key.
      JSON.parse(
        `{"kind":"setOutputs","paperId":"res-a","outputs":{"__proto__":${JSON.stringify(output('res-a', 'blk-1'))}},"sources":{"__proto__":"x"}}`,
      ),
    ]) {
      refused(op);
    }
  });

  it('keeps only known output fields', () => {
    expect(cleanOutput({ ...output('res-a', 'blk-1'), url: 'https://evil.example' }, 'res-a')).toEqual(output('res-a', 'blk-1'));
    expect(cleanOutput({ ...output('res-a', 'blk-1'), width: Infinity }, 'res-a')).toBeNull();
    expect(cleanOutput({ ...output('res-a', 'blk-1'), counters: { table: '2' } }, 'res-a')).toBeNull();
  });
});

describe('the results-wide list', () => {
  const site = { viewers: ['Dave'], collaboratorIds: { dave: 104 } };
  const dave = { login: 'dave', id: 104 };
  const papers = [paper('res-a', { editors: ['bob'], collaboratorIds: { bob: 102 } }), paper('res-b')];

  it('lets its people view every paper, as viewers', () => {
    expect(roleOf(papers[1], dave, site)).toBe('viewer');
    expect(roleOf(papers[1], dave)).toBeNull();
    expect(roleOf(papers[1], { login: 'dave', id: 999 }, site)).toBeNull();
    expect(hasAnyRole([], dave, site)).toBe(true);
    const view = papersFor(papers, dave, true, site);
    expect(view.roles).toEqual({ 'res-a': 'viewer', 'res-b': 'viewer' });
    expect(view.papers[0].blocks[0]).not.toHaveProperty('source');
  });

  it("keeps a paper's own role when it is higher", () => {
    expect(roleOf(papers[0], { login: 'bob', id: 102 }, { viewers: ['bob'], collaboratorIds: { bob: 102 } })).toBe('editor');
  });

  it('reads results-access.json defensively', () => {
    expect(parseAccess(null)).toEqual({});
    expect(parseAccess('not json')).toEqual({});
    expect(parseAccess(JSON.stringify({ viewers: ['a', 3], collaboratorIds: { a: 1, b: 'x' } }))).toEqual({ viewers: ['a'], collaboratorIds: { a: 1 } });
  });
});
