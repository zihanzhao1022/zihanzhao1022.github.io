import { ResultBlock, ResultBlockOutput, ResultPaper, ResultReferences } from '../../types';
import { WRAPPER_VERSION, stripComments } from '../tex/document';
import { FileWrite } from './backend';

/** What a block's compile starts from: the counters where the page left off, the page's labels and citations. */
export interface BlockContext {
  counters: Record<string, number>;
  labels: Record<string, string>;
  citations: Record<string, string>;
}

export function blockContext(blocks: ResultBlock[], index: number, citations: Record<string, string> = {}): BlockContext {
  let counters: Record<string, number> = {};
  for (let previous = index - 1; previous >= 0; previous -= 1) {
    const found = blocks[previous].output?.counters;
    if (found) {
      counters = found;
      break;
    }
  }
  const labels: Record<string, string> = {};
  for (const block of blocks) Object.assign(labels, block.output?.labels ?? {});
  return { counters, labels, citations };
}

const REFERENCE = /\\(?:ref|eqref|autoref|cref|Cref|pageref|nameref|vref|subref)\*?\{([^}]*)\}/g;

/** Labels a source refers to, sorted. */
export function referencedLabels(source: string): string[] {
  const names = new Set<string>();
  for (const match of stripComments(source).matchAll(REFERENCE)) {
    for (const name of match[1].split(',')) if (name.trim()) names.add(name.trim());
  }
  return [...names].sort();
}

// \cite, \citep, \citet, \citeauthor, \parencite, \textcite, \nocite… with up to two optional arguments.
const CITATION = /\\[A-Za-z]*cite[A-Za-z]*\*?(?:\[[^\]]*\]){0,2}\{([^}]*)\}/g;

/** Citation keys a source uses, in order of first use. */
export function citedKeys(source: string): string[] {
  const keys: string[] = [];
  for (const match of stripComments(source).matchAll(CITATION)) {
    for (const raw of match[1].split(',')) {
      const key = raw.trim();
      if (key && key !== '*' && !keys.includes(key)) keys.push(key);
    }
  }
  return keys;
}

/** Keys the page cites, in order of first citation from the top: the order a numeric bibliography follows. */
export const paperCitations = (blocks: ResultBlock[]): string[] => [...new Set(blocks.flatMap((block) => citedKeys(block.source ?? '')))];

/** A 53-bit string hash (cyrb53) as 14 hex digits; enough to notice that a block's inputs changed. */
export function hashText(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/** Attachments the preamble or the block mentions (by name, with or without extension). */
export function usedFiles(paper: ResultPaper, block: ResultBlock): string[] {
  const text = `${paper.preamble ?? ''}\n${block.source ?? ''}`;
  return (paper.files ?? []).filter((name) => text.includes(name.replace(/\.[^.]+$/, '')));
}

/** Everything the block's PDF depends on. */
export function inputHash(paper: ResultPaper, block: ResultBlock, context: BlockContext): string {
  const counters = Object.keys(context.counters)
    .sort()
    .map((name) => [name, context.counters[name]]);
  const references = referencedLabels(block.source ?? '').map((name) => [name, context.labels[name] ?? null]);
  const cited = citedKeys(block.source ?? '');
  return hashText(
    JSON.stringify({
      wrapper: WRAPPER_VERSION,
      preamble: paper.preamble ?? '',
      files: usedFiles(paper, block).map((name) => [name, paper.fileHashes?.[name] ?? null]),
      kind: block.kind,
      source: block.source ?? '',
      counters,
      references,
      // Only blocks that cite get this, so the others keep their hashes.
      ...(cited.length > 0 ? { citations: cited.map((key) => [key, context.citations[key] ?? null]) } : {}),
    }),
  );
}

/** Everything the bibliography's PDF depends on. */
export function referencesHash(paper: ResultPaper, keys: string[], style: string): string {
  const files = (paper.files ?? []).filter((name) => /\.(bib|bst)$/.test(name));
  return hashText(
    JSON.stringify({
      wrapper: WRAPPER_VERSION,
      preamble: paper.preamble ?? '',
      style,
      keys,
      files: files.map((name) => [name, paper.fileHashes?.[name] ?? null]),
    }),
  );
}

export const referencesPath = (paperId: string, hash: string): string => `results/${paperId}/references-${hash.slice(0, 8)}.pdf`;

export type CompiledReferences =
  | { ok: true; pdf: Uint8Array; width: number; height: number; citations: Record<string, string> }
  | { ok: false; message: string };

/** How a rebuild typesets the paper's bibliography. */
export interface ReferencesBuilder {
  /** Keys references.bib defines; null when the paper has no references.bib. */
  bibKeys: Set<string> | null;
  /** The \bibliographystyle to use. */
  style: string;
  compile: (keys: string[]) => Promise<CompiledReferences>;
}

export const outputPath = (paperId: string, blockId: string, hash: string): string =>
  `results/${paperId}/${blockId}-${hash.slice(0, 8)}.pdf`;

export type CompiledBlock =
  | { ok: true; pdf: Uint8Array; width: number; height: number; counters: Record<string, number>; labels: Record<string, string> }
  | { ok: false; message: string };

export type CompileFn = (block: ResultBlock, context: BlockContext) => Promise<CompiledBlock>;

export interface RebuildResult {
  /** New outputs of the blocks that were compiled. */
  outputs: Record<string, ResultBlockOutput>;
  /** The source each new output was compiled from (see the setOutputs operation). */
  sources: Record<string, string>;
  writes: FileWrite[];
  /** PDFs the new outputs replace. */
  deletes: string[];
  /** The new bibliography, null when there is none any more; absent when it did not change. */
  references?: ResultReferences | null;
  /** The block that failed to compile ("references" for the bibliography); the blocks before it are still rebuilt. */
  failed?: { blockId: string; message: string };
}

/** Says what a failed rebuild could not compile, counting blocks from 1. */
export function describeFailure(blocks: ResultBlock[], failed: { blockId: string; message: string }, prefix = ''): string {
  if (failed.blockId === 'references') return `参考文献编译失败：${failed.message}`;
  return `${prefix}第 ${blocks.findIndex((block) => block.id === failed.blockId) + 1} 个块编译失败：${failed.message}`;
}

/**
 * Compiles every block whose inputs changed, in page order, so numbers and references follow LaTeX's rules
 * across blocks. Labels can point forward, so passes repeat until nothing changes (at most `maxPasses`).
 */
export async function rebuild(
  paper: ResultPaper,
  compile: CompileFn,
  { maxPasses = 3, references: builder }: { maxPasses?: number; references?: ReferencesBuilder } = {},
): Promise<RebuildResult> {
  const blocks = [...paper.blocks];
  const outputs: Record<string, ResultBlockOutput> = {};
  const sources: Record<string, string> = {};
  const writes = new Map<string, Uint8Array>();
  const original = new Set(paper.blocks.map((block) => block.output?.pdf).filter((path): path is string => !!path));
  if (paper.references) original.add(paper.references.pdf);
  const deletes = new Set<string>();
  let references: ResultReferences | null | undefined;
  const result = (failed?: RebuildResult['failed']): RebuildResult => ({
    outputs,
    sources,
    writes: [...writes].map(([path, data]) => ({ path, data })),
    deletes: [...deletes],
    ...(references === undefined ? {} : { references }),
    ...(failed ? { failed } : {}),
  });

  // The bibliography first: the blocks' \cite show what it numbered. It lists the cited keys that
  // references.bib has (a missing key would leave it empty, which LaTeX refuses), in order of first citation.
  let citations = paper.references?.citations ?? {};
  if (builder) {
    const keys = builder.bibKeys ? paperCitations(blocks).filter((key) => builder.bibKeys!.has(key)) : [];
    if (keys.length === 0) {
      if (paper.references) {
        references = null;
        deletes.add(paper.references.pdf);
      }
      citations = {};
    } else {
      const hash = referencesHash(paper, keys, builder.style);
      if (paper.references?.inputHash !== hash) {
        const compiled = await builder.compile(keys);
        if (!compiled.ok) return result({ blockId: 'references', message: compiled.message });
        const pdf = referencesPath(paper.id, hash);
        if (paper.references && paper.references.pdf !== pdf) deletes.add(paper.references.pdf);
        writes.set(pdf, compiled.pdf);
        references = { pdf, width: compiled.width, height: compiled.height, inputHash: hash, citations: compiled.citations };
        citations = compiled.citations;
      }
    }
  }

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changed = false;
    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index];
      if (!block.source?.trim()) continue;
      const context = blockContext(blocks, index, citations);
      const hash = inputHash(paper, block, context);
      if (block.output?.inputHash === hash) continue;
      const compiled = await compile(block, context);
      if (!compiled.ok) return result({ blockId: block.id, message: compiled.message });
      const pdf = outputPath(paper.id, block.id, hash);
      const previous = block.output?.pdf;
      if (previous && previous !== pdf) {
        if (writes.has(previous)) writes.delete(previous);
        if (original.has(previous)) deletes.add(previous);
      }
      writes.set(pdf, compiled.pdf);
      deletes.delete(pdf);
      const output: ResultBlockOutput = {
        pdf,
        width: compiled.width,
        height: compiled.height,
        inputHash: hash,
        counters: compiled.counters,
        labels: compiled.labels,
      };
      blocks[index] = { ...block, output };
      outputs[block.id] = output;
      sources[block.id] = block.source;
      changed = true;
    }
    if (!changed) break;
  }
  return result();
}

/** Blocks whose PDF no longer matches their inputs (a first-pass view, without recompiling anything). */
export function staleBlocks(paper: ResultPaper): string[] {
  const citations = paper.references?.citations ?? {};
  return paper.blocks
    .filter((block, index) => block.source?.trim() && block.output?.inputHash !== inputHash(paper, block, blockContext(paper.blocks, index, citations)))
    .map((block) => block.id);
}
