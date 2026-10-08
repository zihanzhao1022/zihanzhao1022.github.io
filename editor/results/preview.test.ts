import { describe, expect, it } from 'vitest';
import { ResultBlock, ResultPaper } from '../../types';
import { CompileInput, CompileOutput, TexEngine } from '../tex/engine';
import { REFERENCES_FILE } from './compile';
import { createBlockPreview } from './preview';

const pdf = new Uint8Array([37, 80, 68, 70]);
const measure = async () => ({ width: 345, height: 120 });
const bytes = (text: string) => new TextEncoder().encode(text);
const bib = (...keys: string[]) => bytes(keys.map((key) => '@article{' + key + ', title={Title}, author={Author}, year={2024}}').join('\n'));
const block = (id: string, source: string): ResultBlock => ({ id, kind: 'text', source });
const paper = (blocks: ResultBlock[], extra: Partial<ResultPaper> = {}): ResultPaper => ({
  id: 'p1',
  slug: 'p1',
  title: 'Experiments',
  authors: ['Author'],
  preamble: '\\documentclass{article}\\usepackage{natbib}',
  files: [REFERENCES_FILE],
  blocks,
  ...extra,
});
const success = (aux = '', log = ''): CompileOutput => ({ ok: true, status: 0, pdf, aux, log });
const citations = (values: Record<string, string>): string =>
  Object.entries(values).map(([key, value]) => '\\bibcite{' + key + '}{' + value + '}').join('\n');

/** Records the actual documents and aux files sent to the engine, including the BibTeX pass. */
function scriptedEngine(...outputs: CompileOutput[]): TexEngine & { inputs: CompileInput[] } {
  const inputs: CompileInput[] = [];
  return {
    inputs,
    compile: async (input) => {
      inputs.push(input);
      const output = outputs.shift();
      if (!output) throw new Error('unexpected compile');
      return output;
    },
  };
}

describe('createBlockPreview', () => {
  it('resolves a newly typed citation from the bib before previewing, using draft page order', async () => {
    const editing = block('editing', '\\cite{removed}');
    const currentPaper = paper([
      block('before', '\\cite{before}'),
      editing,
      block('after', '\\cite{after,new}'),
    ], {
      references: {
        pdf: 'old-references.pdf', width: 1, height: 1,
        citations: { before: '{1}', removed: '{2}', after: '{3}' },
      },
    });
    const engine = scriptedEngine(
      success(citations({ before: '{1}', new: '{2}', after: '{3}' })),
      success(),
    );
    const preview = createBlockPreview(currentPaper, editing, {
      [REFERENCES_FILE]: bib('before', 'removed', 'new', 'after'),
    }, measure);

    const result = await preview(engine, 'New experiment \\cite{new,before}');

    expect(result).toMatchObject({ ok: true, pdf, warnings: [], references: { pdf, width: 345, height: 120 } });
    expect(engine.inputs).toHaveLength(2);
    expect(engine.inputs[0].bibtex).toBe(true);
    expect(engine.inputs[0].main).toContain('\\nocite{before,new,after}');
    expect(engine.inputs[0].main).not.toContain('\\nocite{before,removed');
    expect(engine.inputs[1].main).toContain('New experiment \\cite{new,before}');
    expect(engine.inputs[1].files?.['main.aux']).toContain('\\bibcite{new}{{2}}');
    expect(engine.inputs[1].files?.['main.aux']).not.toContain('\\bibcite{removed}');
    expect(currentPaper.blocks[1].source).toBe('\\cite{removed}');
  });

  it('includes a new unsaved block after the existing page citations', async () => {
    const editing = block('new-block', '');
    const engine = scriptedEngine(success(citations({ first: '{1}', added: '{2}' })), success());
    const preview = createBlockPreview(paper([block('first', '\\cite{first}')]), editing, {
      [REFERENCES_FILE]: bib('first', 'added'),
    }, measure);

    expect((await preview(engine, '\\cite{added,first}')).ok).toBe(true);
    expect(engine.inputs[0].main).toContain('\\nocite{first,added}');
    expect(engine.inputs[1].files?.['main.aux']).toContain('\\bibcite{added}{{2}}');
  });

  it('uses a bibliography style from the current attachments even if the saved file list is stale', async () => {
    const editing = block('b1', '\\cite{a}');
    const engine = scriptedEngine(success(citations({ a: '{1}' })), success());
    const preview = createBlockPreview(paper([editing], { files: [REFERENCES_FILE, 'old.bst'] }), editing, {
      [REFERENCES_FILE]: bib('a'),
      'uploaded.bst': bytes('current style'),
    }, measure);

    await preview(engine, editing.source!);

    expect(engine.inputs[0].main).toContain('\\bibliographystyle{uploaded}');
    expect(engine.inputs[0].main).not.toContain('\\bibliographystyle{old}');
  });

  it('reuses a successful bibliography for prose edits and regenerates it when citation keys change', async () => {
    const editing = block('b1', '');
    const engine = scriptedEngine(
      success(citations({ a: '{1}' })), success(), success(),
      success(citations({ a: '{1}', b: '{2}' })), success(),
    );
    const preview = createBlockPreview(paper([editing]), editing, {
      [REFERENCES_FILE]: bib('a', 'b'),
    }, measure);

    await preview(engine, 'First draft \\cite{a}');
    await preview(engine, 'Revised prose \\cite{a}');
    await preview(engine, 'Revised evidence \\cite{a,b}');

    const bibliographies = engine.inputs.filter((input) => input.bibtex);
    expect(bibliographies).toHaveLength(2);
    expect(bibliographies[0].main).toContain('\\nocite{a}');
    expect(bibliographies[1].main).toContain('\\nocite{a,b}');
    expect(engine.inputs[2].main).toContain('Revised prose \\cite{a}');
    expect(engine.inputs[2].files?.['main.aux']).toContain('\\bibcite{a}{{1}}');
    expect(engine.inputs[4].files?.['main.aux']).toContain('\\bibcite{b}{{2}}');
  });

  it('regenerates saved citation metadata after the bibliography bytes have been edited', async () => {
    const editing = block('b1', '\\citet{a}');
    const currentPaper = paper([editing], {
      references: {
        pdf: 'saved-references.pdf', width: 1, height: 1,
        citations: { a: '{1}{2023}{{Old Author}}{{}}' },
      },
    });
    const originalFiles = { [REFERENCES_FILE]: bytes('@article{a, author={Old Author}, year={2023}, title={A}}') };
    const editedFiles = { [REFERENCES_FILE]: bytes('@article{a, author={New Author}, year={2024}, title={A}}') };
    const engine = scriptedEngine(
      success(citations({ a: '{1}{2023}{{Old Author}}{{}}' })), success(),
      success(citations({ a: '{1}{2024}{{New Author}}{{}}' })), success(),
    );

    await createBlockPreview(currentPaper, editing, originalFiles, measure)(engine, editing.source!);
    await createBlockPreview(currentPaper, editing, editedFiles, measure)(engine, editing.source!);

    expect(engine.inputs.filter((input) => input.bibtex)).toHaveLength(2);
    expect(engine.inputs[2].files?.[REFERENCES_FILE]).toEqual(editedFiles[REFERENCES_FILE]);
    expect(engine.inputs[3].files?.['main.aux']).toContain('\\bibcite{a}{{1}{2024}{{New Author}}{{}}}');
    expect(engine.inputs[3].files?.['main.aux']).not.toContain('Old Author');
  });

  it('reports bibliography failures before compiling the block and retries them on the next preview', async () => {
    const editing = block('b1', '\\cite{a}');
    const engine = scriptedEngine(
      { ok: false, status: 1, log: 'Could not load bibliography style', reason: 'style unavailable' },
      success(citations({ a: '{1}' })), success(),
    );
    const preview = createBlockPreview(paper([editing]), editing, { [REFERENCES_FILE]: bib('a') }, measure);

    const failed = await preview(engine, editing.source!);

    expect(failed.ok).toBe(false);
    expect(failed.pdf).toBeUndefined();
    expect(failed.issues.map((issue) => issue.message).join(' ')).toMatch(/参考文献|bibliograph/i);
    expect(engine.inputs).toHaveLength(1);
    expect(engine.inputs[0].bibtex).toBe(true);

    expect((await preview(engine, editing.source!)).ok).toBe(true);
    expect(engine.inputs.filter((input) => input.bibtex)).toHaveLength(2);
    expect(engine.inputs[2].files?.['main.aux']).toContain('\\bibcite{a}{{1}}');
  });

  it('leaves genuinely missing citation warnings visible while resolving the known entries', async () => {
    const editing = block('b1', '\\cite{known,missing}');
    const warning = "Package natbib Warning: Citation 'missing' on page 1 undefined on input line 48.";
    const engine = scriptedEngine(
      success(citations({ known: '{1}' })),
      success('', warning + '\nPackage natbib Warning: There were undefined citations.\n'),
    );
    const preview = createBlockPreview(paper([editing], {
      references: { pdf: 'old.pdf', width: 1, height: 1, citations: { missing: '{99}' } },
    }), editing, { [REFERENCES_FILE]: bib('known') }, measure);

    const result = await preview(engine, editing.source!);

    expect(result.ok).toBe(true);
    expect(result.warnings.join('\n')).toContain("Citation 'missing'");
    expect(engine.inputs[0].main).toContain('\\nocite{known}');
    expect(engine.inputs[1].files?.['main.aux']).toContain('\\bibcite{known}{{1}}');
    expect(engine.inputs[1].files?.['main.aux']).not.toContain('\\bibcite{missing}');
  });

  it.each([
    ['there is no bibliography attachment', {}],
    ['the bibliography defines none of the cited keys', { [REFERENCES_FILE]: bib('unrelated') }],
  ])('skips BibTeX and keeps unresolved citations visible when %s', async (_description, files) => {
    const editing = block('b1', '\\cite{missing}');
    const engine = scriptedEngine(success('', "Package natbib Warning: Citation 'missing' on page 1 undefined on input line 48.\n"));
    const preview = createBlockPreview(paper([editing], {
      references: { pdf: 'old.pdf', width: 1, height: 1, citations: { missing: '{99}' } },
    }), editing, files, measure);

    const result = await preview(engine, editing.source!);

    expect(result.ok).toBe(true);
    expect(result.warnings.join('\n')).toContain("Citation 'missing'");
    expect(engine.inputs).toHaveLength(1);
    expect(engine.inputs[0].bibtex).not.toBe(true);
    expect(engine.inputs[0].files?.['main.aux']).not.toContain('\\bibcite{missing}');
  });
});
