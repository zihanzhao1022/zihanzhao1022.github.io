import { ResultBlock, ResultPaper } from '../../types';
import { DEFAULT_PREAMBLE } from '../tex/document';
import { TexEngine } from '../tex/engine';
import { bibKeysOf, bibliographyStyle } from './bibtex';
import { BlockCompileResult, Measure, REFERENCES_FILE, ReferencesCompileResult, compileBlock, compileReferences } from './compile';
import { blockContext, paperCitations } from './numbering';

/**
 * Preview the draft with the same citation order as saving the whole page. The saved citation map
 * cannot resolve newly typed citations or changes to references.bib. Keep a bibliography per set of
 * cited keys so ordinary typing only recompiles the block; recreate this compiler when files change.
 */
export function createBlockPreview(
  paper: ResultPaper,
  block: ResultBlock,
  files: Record<string, Uint8Array>,
  measure: Measure,
): (engine: TexEngine, source: string) => Promise<BlockCompileResult> {
  const preamble = paper.preamble ?? DEFAULT_PREAMBLE;
  const style = bibliographyStyle({ ...paper, files: Object.keys(files) });
  const bib = files[REFERENCES_FILE];
  const known = bib ? bibKeysOf(new TextDecoder().decode(bib)) : new Set<string>();
  let cached: { key: string; result: Promise<ReferencesCompileResult> } | undefined;

  return async (engine, source) => {
    const draft = { ...block, source };
    const existing = paper.blocks.findIndex((item) => item.id === block.id);
    const index = existing < 0 ? paper.blocks.length : existing;
    const blocks = existing < 0 ? [...paper.blocks, draft] : paper.blocks.map((item) => (item.id === block.id ? draft : item));
    const context = blockContext(blocks, index);
    const keys = paperCitations(blocks).filter((key) => known.has(key));
    let referencePdf: BlockCompileResult['references'];

    if (keys.length > 0) {
      const key = JSON.stringify(keys);
      if (cached?.key !== key) {
        const result = compileReferences(engine, { preamble, keys, style, files }, measure);
        const entry = { key, result };
        cached = entry;
        // A transient compile failure must be retryable with the same input.
        void result.then(
          (out) => {
            if (!out.ok && cached === entry) cached = undefined;
          },
          () => {
            if (cached === entry) cached = undefined;
          },
        );
      }
      const references = await cached.result;
      if (!references.ok) {
        return {
          ok: false,
          width: 0,
          height: 0,
          counters: {},
          labels: {},
          warnings: [],
          issues: references.issues.map((issue) => ({ ...issue, message: `参考文献：${issue.message}` })),
          log: references.log,
        };
      }
      context.citations = references.citations;
      if (references.pdf) referencePdf = { pdf: references.pdf, width: references.width, height: references.height };
    }

    const result = await compileBlock(engine, { preamble, source, kind: block.kind, ...context, files }, measure);
    return { ...result, ...(referencePdf ? { references: referencePdf } : {}) };
  };
}
