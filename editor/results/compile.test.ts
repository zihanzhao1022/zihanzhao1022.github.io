import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREAMBLE } from '../tex/document';
import { CompileInput, CompileOutput, TexEngine } from '../tex/engine';
import { BlockCompileInput, compileBlock, describeIssue } from './compile';

const measure = vi.fn(async () => ({ width: 345, height: 120 }));

const input = (source: string, extra: Partial<BlockCompileInput> = {}): BlockCompileInput => ({
  preamble: DEFAULT_PREAMBLE,
  source,
  kind: 'text',
  counters: {},
  labels: {},
  files: {},
  ...extra,
});

/** An engine whose answers are scripted; it records what it was asked to compile. */
function scriptedEngine(...outputs: CompileOutput[]): TexEngine & { inputs: CompileInput[] } {
  const inputs: CompileInput[] = [];
  return {
    inputs,
    compile: async (compileInput) => {
      inputs.push(compileInput);
      const next = outputs.shift();
      if (!next) throw new Error('unexpected compile');
      return next;
    },
  };
}

const pdf = new Uint8Array([37, 80, 68, 70]);

describe('compileBlock', () => {
  it('returns the PDF, size, counters and labels of a clean run', async () => {
    const engine = scriptedEngine({
      ok: true,
      status: 0,
      pdf,
      log: 'RESULTS-COUNTER:table=3\nLaTeX Warning: Label(s) may have changed. Rerun to get cross-references right.\n',
      aux: '\\relax\n\\newlabel{tab:x}{{3}{1}}\n',
    });
    const result = await compileBlock(engine, input('\\begin{table}\\caption{x}\\label{tab:x}\\end{table}', { kind: 'table', files: { 'a.sty': pdf } }), measure);
    expect(result).toMatchObject({ ok: true, pdf, width: 345, height: 120, counters: { table: 3 }, labels: { 'tab:x': '{3}{1}' }, issues: [], warnings: [] });
    expect(Object.keys(engine.inputs[0].files ?? {})).toEqual(['a.sty', 'main.aux']);
  });

  it('compiles again when the block refers to a label it defines itself', async () => {
    const engine = scriptedEngine(
      { ok: true, status: 0, pdf, log: '', aux: '\\newlabel{eq:a}{{1}{1}}\n' },
      { ok: true, status: 0, pdf, log: '', aux: '\\newlabel{eq:a}{{1}{1}}\n' },
    );
    const result = await compileBlock(engine, input('\\begin{equation}x\\label{eq:a}\\end{equation} see (\\ref{eq:a})'), measure);
    expect(engine.inputs).toHaveLength(2);
    expect(engine.inputs[1].files?.['main.aux']).toContain('\\newlabel{eq:a}{{1}{1}}');
    expect(result.ok).toBe(true);
  });

  it('does not compile twice when the references were already known', async () => {
    const engine = scriptedEngine({ ok: true, status: 0, pdf, log: '', aux: '\\newlabel{eq:a}{{1}{1}}\n' });
    await compileBlock(engine, input('x\\label{eq:a} \\ref{eq:a}', { labels: { 'eq:a': '{1}{1}' } }), measure);
    expect(engine.inputs).toHaveLength(1);
  });

  it('maps errors to the block, the preamble or an attachment and refuses the PDF', async () => {
    const source = 'line one\n\\undefinedthing';
    const doc = (await import('../tex/document')).buildBlockDocument({ preamble: DEFAULT_PREAMBLE, source, kind: 'text' });
    const engine = scriptedEngine({
      ok: true,
      status: 1,
      pdf,
      log: [
        '(main.tex',
        '! Undefined control sequence.',
        `l.${doc.sourceStartLine + 1} \\undefinedthing`,
        '',
        '(acl.sty',
        '! Missing number, treated as zero.',
        'l.4 \\hello',
        ')',
      ].join('\n'),
    });
    const result = await compileBlock(engine, input(source), measure);
    expect(result.ok).toBe(false);
    expect(result.pdf).toBeUndefined();
    expect(result.issues).toEqual([
      { message: 'Undefined control sequence.', area: 'source', line: 2 },
      { message: 'Missing number, treated as zero.', area: 'file', file: 'acl.sty', line: 4 },
    ]);
    expect(result.issues.map(describeIssue)).toEqual([
      '代码第 2 行：Undefined control sequence.',
      'acl.sty 第 4 行：Missing number, treated as zero.',
    ]);
  });

  it('reports a run without a PDF even when the log names no error', async () => {
    const result = await compileBlock(scriptedEngine({ ok: false, status: -254, log: 'Engine crashed' }), input('x'), measure);
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([{ message: 'TeX 没有生成 PDF，详情见日志', area: 'wrapper' }]);
  });
});
