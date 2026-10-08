import { describe, expect, it, vi } from 'vitest';
import { ResultBlock, ResultPaper } from '../../types';
import { BlockContext, CompileFn, blockContext, hashText, inputHash, outputPath, rebuild, referencedLabels, staleBlocks, usedFiles } from './numbering';

const paper = (blocks: ResultBlock[]): ResultPaper => ({
  id: 'p1',
  slug: 'p1',
  title: 'Made up',
  authors: [],
  preamble: '\\documentclass{article}',
  files: [],
  blocks,
});

describe('referencedLabels', () => {
  it('finds the labels a source refers to, ignoring comments', () => {
    const source = 'See Table~\\ref{tab:a} and \\eqref{eq:b}; \\cref{fig:c, fig:d}. % \\ref{tab:commented}';
    expect(referencedLabels(source)).toEqual(['eq:b', 'fig:c', 'fig:d', 'tab:a']);
  });
});

describe('hashText', () => {
  it('is stable and sensitive', () => {
    expect(hashText('abc')).toBe(hashText('abc'));
    expect(hashText('abc')).not.toBe(hashText('abd'));
    expect(hashText('abc')).toMatch(/^[0-9a-f]{14}$/);
  });
});

describe('blockContext', () => {
  it('continues from the nearest earlier compiled block and offers every label on the page', () => {
    const blocks: ResultBlock[] = [
      { id: 'a', kind: 'table', output: { pdf: 'x', width: 1, height: 1, counters: { table: 1 }, labels: { 'tab:a': '{1}{1}' } } },
      { id: 'b', kind: 'text' },
      { id: 'c', kind: 'table', output: { pdf: 'y', width: 1, height: 1, counters: { table: 2 }, labels: { 'tab:c': '{2}{1}' } } },
    ];
    expect(blockContext(blocks, 0)).toEqual({ counters: {}, labels: { 'tab:a': '{1}{1}', 'tab:c': '{2}{1}' } });
    expect(blockContext(blocks, 2).counters).toEqual({ table: 1 });
  });
});

describe('usedFiles', () => {
  it('keeps the attachments the preamble or the block mentions', () => {
    const withFiles = { ...paper([]), preamble: '\\usepackage{acl}', files: ['acl.sty', 'bars.png', 'other.pdf'] };
    expect(usedFiles(withFiles, { id: 'f', kind: 'figure', source: '\\includegraphics{bars}' })).toEqual(['acl.sty', 'bars.png']);
  });
});

describe('inputHash', () => {
  const block: ResultBlock = { id: 'a', kind: 'text', source: 'See \\ref{tab:x}.' };
  const context: BlockContext = { counters: { section: 1 }, labels: { 'tab:x': '{1}{1}', 'tab:other': '{2}{1}' } };

  it('changes with the source, preamble, counters and referenced labels only', () => {
    const base = inputHash(paper([block]), block, context);
    expect(inputHash(paper([block]), { ...block, source: 'See \\ref{tab:x}!' }, context)).not.toBe(base);
    expect(inputHash({ ...paper([block]), preamble: 'x' }, block, context)).not.toBe(base);
    expect(inputHash(paper([block]), block, { ...context, counters: { section: 2 } })).not.toBe(base);
    expect(inputHash(paper([block]), block, { ...context, labels: { ...context.labels, 'tab:x': '{3}{1}' } })).not.toBe(base);
    expect(inputHash(paper([block]), block, { ...context, labels: { ...context.labels, 'tab:other': '{9}{1}' } })).toBe(base);
    expect(inputHash({ ...paper([block]), files: ['unused.png'] }, block, context)).toBe(base);
  });
});

/** A fake compiler: tables count up, and a text block prints the number of the table it refers to. */
function fakeCompiler(): { compile: CompileFn; calls: string[] } {
  const calls: string[] = [];
  const compile: CompileFn = async (block, context) => {
    calls.push(block.id);
    const counters = { ...context.counters };
    const labels: Record<string, string> = {};
    if (block.kind === 'table') {
      counters.table = (counters.table ?? 0) + 1;
      const label = /\\label\{([^}]*)\}/.exec(block.source ?? '')?.[1];
      if (label) labels[label] = `{${counters.table}}{1}`;
    }
    if (block.source?.includes('FAIL')) return { ok: false, message: 'Undefined control sequence.' };
    return { ok: true, pdf: new TextEncoder().encode(`${block.id}:${JSON.stringify(context)}`), width: 100, height: 20, counters, labels };
  };
  return { compile, calls };
}

describe('rebuild', () => {
  it('compiles new blocks in order and numbers them across the page', async () => {
    const { compile, calls } = fakeCompiler();
    const result = await rebuild(
      paper([
        { id: 't1', kind: 'table', source: '\\label{tab:one}' },
        { id: 't2', kind: 'table', source: '\\label{tab:two}' },
      ]),
      compile,
    );
    expect(calls).toEqual(['t1', 't2']);
    expect(result.outputs.t1.counters).toEqual({ table: 1 });
    expect(result.outputs.t2.counters).toEqual({ table: 2 });
    expect(result.outputs.t2.labels).toEqual({ 'tab:two': '{2}{1}' });
    expect(result.writes.map((write) => write.path)).toEqual([result.outputs.t1.pdf, result.outputs.t2.pdf]);
    expect(result.outputs.t1.pdf).toBe(outputPath('p1', 't1', result.outputs.t1.inputHash!));
  });

  it('resolves references to later blocks with a second pass', async () => {
    const { compile, calls } = fakeCompiler();
    const result = await rebuild(
      paper([
        { id: 'intro', kind: 'text', source: 'As Table~\\ref{tab:main} shows' },
        { id: 'main', kind: 'table', source: '\\label{tab:main}' },
      ]),
      compile,
    );
    expect(calls).toEqual(['intro', 'main', 'intro']);
    expect(new TextDecoder().decode(result.writes.find((write) => write.path === result.outputs.intro.pdf)!.data)).toContain(
      '"tab:main":"{1}{1}"',
    );
    // The first-pass PDF of the intro was never committed, so it is neither written nor deleted.
    expect(result.writes).toHaveLength(2);
    expect(result.deletes).toEqual([]);
  });

  it('skips up-to-date blocks and replaces the PDFs of changed ones', async () => {
    const first = await rebuild(paper([{ id: 't1', kind: 'table', source: 'a' }, { id: 't2', kind: 'table', source: 'b' }]), fakeCompiler().compile);
    const compiled: ResultBlock[] = [
      { id: 't1', kind: 'table', source: 'a', output: first.outputs.t1 },
      { id: 't2', kind: 'table', source: 'b', output: first.outputs.t2 },
    ];
    expect(staleBlocks(paper(compiled))).toEqual([]);

    const { compile, calls } = fakeCompiler();
    const changed = [{ ...compiled[0], source: 'a2' }, compiled[1]];
    expect(staleBlocks(paper(changed))).toEqual(['t1']);
    const second = await rebuild(paper(changed), compile);
    expect(calls).toEqual(['t1']);
    expect(second.deletes).toEqual([first.outputs.t1.pdf]);
  });

  it('recompiles later blocks whose numbers moved after a reorder', async () => {
    const first = await rebuild(paper([{ id: 't1', kind: 'table', source: 'a' }, { id: 't2', kind: 'table', source: 'b' }]), fakeCompiler().compile);
    const swapped: ResultBlock[] = [
      { id: 't2', kind: 'table', source: 'b', output: first.outputs.t2 },
      { id: 't1', kind: 'table', source: 'a', output: first.outputs.t1 },
    ];
    const { compile, calls } = fakeCompiler();
    const second = await rebuild(paper(swapped), compile);
    expect(calls).toEqual(['t2', 't1']);
    expect(second.outputs.t2.counters).toEqual({ table: 1 });
    expect(second.outputs.t1.counters).toEqual({ table: 2 });
  });

  it('stops at a block that fails and keeps what was compiled before it', async () => {
    const { compile } = fakeCompiler();
    const result = await rebuild(
      paper([
        { id: 't1', kind: 'table', source: 'ok' },
        { id: 'bad', kind: 'table', source: 'FAIL' },
        { id: 't3', kind: 'table', source: 'never reached' },
      ]),
      compile,
    );
    expect(result.failed).toEqual({ blockId: 'bad', message: 'Undefined control sequence.' });
    expect(Object.keys(result.outputs)).toEqual(['t1']);
  });

  it('leaves empty blocks alone', async () => {
    const compile = vi.fn<CompileFn>();
    const result = await rebuild(paper([{ id: 'e', kind: 'text', source: '  ' }]), compile);
    expect(compile).not.toHaveBeenCalled();
    expect(result.outputs).toEqual({});
  });
});
