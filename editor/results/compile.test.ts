import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREAMBLE } from '../tex/document';
import { CompileInput, CompileOutput, TexEngine } from '../tex/engine';
import { BlockCompileInput, compileBlock, compileReferences, describeIssue } from './compile';

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

  it("explains failures of the engine itself, e.g. a compile that never ended", async () => {
    const reason = '编译超时：可能有无限循环的宏';
    const result = await compileBlock(scriptedEngine({ ok: false, status: -254, log: reason, reason }), input('x'), measure);
    expect(result.issues).toEqual([{ message: reason, area: 'wrapper' }]);
  });
});

describe('compileReferences', () => {
  const referencesInput = (keys = ['qwen']): Parameters<typeof compileReferences>[1] => ({
    preamble: `${DEFAULT_PREAMBLE}\n\\usepackage{natbib}`,
    keys,
    style: 'plainnat',
    files: { 'references.bib': new TextEncoder().encode('@article{qwen, author={Yang}, title={Qwen}, year={2024}}') },
  });

  it('returns complete natbib citation data and compiles with the bibliography attachment and style', async () => {
    const engine = scriptedEngine({
      ok: true,
      status: 0,
      pdf,
      log: 'Output written on main.pdf.',
      bibtexLog: 'This is BibTeX\nThe style file: plainnat.bst',
      aux: '\\bibcite{qwen}{{1}{2024}{{Yang et~al.}}{{Yang, Bai, and Zhang}}}\n',
    });
    const refInput = referencesInput();
    const result = await compileReferences(engine, refInput, measure);
    expect(result).toMatchObject({
      ok: true,
      pdf,
      width: 345,
      height: 120,
      citations: { qwen: '{1}{2024}{{Yang et~al.}}{{Yang, Bai, and Zhang}}' },
      issues: [],
    });
    expect(engine.inputs[0]).toMatchObject({ bibtex: true, files: refInput.files });
    expect(engine.inputs[0].main).toContain('\\nocite{qwen}\n\\bibliographystyle{plainnat}\n\\bibliography{references}');
    expect(result.log).toContain('Output written on main.pdf.');
    expect(result.log).toContain('The style file: plainnat.bst');
  });

  it('reports BibTeX errors even when the final TeX pass produces a PDF and citations', async () => {
    const bibtexLog = 'Repeated entry---line 6 of file references.bib\n(There was 1 error message)';
    const size = vi.fn(measure);
    const result = await compileReferences(scriptedEngine({
      ok: true,
      status: 0,
      pdf,
      log: 'Output written on main.pdf.',
      aux: '\\bibcite{qwen}{{1}{2024}{{Yang}}{{}}}\n',
      bibtexLog,
    }), referencesInput(), size);
    expect(result.ok).toBe(false);
    expect(result.pdf).toBeUndefined();
    expect(result.issues).toEqual([{ message: `BibTeX：${bibtexLog.replace('\n', ' ')}`, area: 'wrapper' }]);
    expect(result.log).toContain(bibtexLog);
    expect(size).not.toHaveBeenCalled();
  });

  it.each([
    { aux: '', keys: ['qwen'], missing: 'qwen' },
    { aux: '\\bibcite{qwen}{{1}{2024}{{Yang}}{{}}}\n', keys: ['qwen', 'llama'], missing: 'llama' },
  ])('rejects missing citation data for $missing and explains what to check', async ({ aux, keys, missing }) => {
    const result = await compileReferences(scriptedEngine({ ok: true, status: 0, pdf, log: '', aux }), referencesInput(keys), measure);
    expect(result).toMatchObject({ ok: false, pdf: undefined, width: 0, height: 0 });
    expect(result.issues).toEqual([{
      message: `未生成以下引用：${missing}。请检查 references.bib 中的引用键、条目格式和 BibTeX 日志。`,
      area: 'wrapper',
    }]);
  });

  it('allows nonfatal BibTeX warnings when all requested citations were generated', async () => {
    const bibtexLog = 'Warning--empty year in qwen\n(There was 1 warning)';
    const result = await compileReferences(scriptedEngine({
      ok: true,
      status: 0,
      pdf,
      log: '',
      aux: '\\bibcite{qwen}{{1}{}{{Yang}}{{}}}\n',
      bibtexLog,
    }), referencesInput(), measure);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.log).toContain(bibtexLog);
  });

  it('preserves an engine failure reason when there is no bibliography error', async () => {
    const reason = '编译超时：可能有无限循环的宏';
    const result = await compileReferences(scriptedEngine({ ok: false, status: -254, log: reason, reason }), referencesInput(), measure);
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([{ message: reason, area: 'wrapper' }]);
  });
});
