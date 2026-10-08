import { ResultBlock, ResultBlockOutput, ResultPaper } from '../../types';
import { WRAPPER_VERSION, stripComments } from '../tex/document';
import { FileWrite } from './backend';

/** What a block's compile starts from: the counters where the page left off, and the page's labels. */
export interface BlockContext {
  counters: Record<string, number>;
  labels: Record<string, string>;
}

export function blockContext(blocks: ResultBlock[], index: number): BlockContext {
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
  return { counters, labels };
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
  return hashText(
    JSON.stringify({
      wrapper: WRAPPER_VERSION,
      preamble: paper.preamble ?? '',
      files: usedFiles(paper, block),
      kind: block.kind,
      source: block.source ?? '',
      counters,
      references,
    }),
  );
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
  writes: FileWrite[];
  /** PDFs the new outputs replace. */
  deletes: string[];
  /** The block that failed to compile; the blocks before it are still rebuilt. */
  failed?: { blockId: string; message: string };
}

/**
 * Compiles every block whose inputs changed, in page order, so numbers and references follow LaTeX's rules
 * across blocks. Labels can point forward, so passes repeat until nothing changes (at most `maxPasses`).
 */
export async function rebuild(paper: ResultPaper, compile: CompileFn, maxPasses = 3): Promise<RebuildResult> {
  const blocks = [...paper.blocks];
  const outputs: Record<string, ResultBlockOutput> = {};
  const writes = new Map<string, Uint8Array>();
  const original = new Set(paper.blocks.map((block) => block.output?.pdf).filter((path): path is string => !!path));
  const deletes = new Set<string>();
  const result = (failed?: RebuildResult['failed']): RebuildResult => ({
    outputs,
    writes: [...writes].map(([path, data]) => ({ path, data })),
    deletes: [...deletes],
    ...(failed ? { failed } : {}),
  });

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changed = false;
    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index];
      if (!block.source?.trim()) continue;
      const context = blockContext(blocks, index);
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
      changed = true;
    }
    if (!changed) break;
  }
  return result();
}

/** Blocks whose PDF no longer matches their inputs (a first-pass view, without recompiling anything). */
export function staleBlocks(paper: ResultPaper): string[] {
  return paper.blocks
    .filter((block, index) => block.source?.trim() && block.output?.inputHash !== inputHash(paper, block, blockContext(paper.blocks, index)))
    .map((block) => block.id);
}
