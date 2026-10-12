import { FloatKind, ResultBlock } from '../../types';
import { stripComments } from '../tex/document';
import { BLOCK_TEMPLATES } from './actions';
import { ResultsOp } from './ops';
import { createTable } from './table/model';
import { serializeTable } from './table/latex';

/** The text of the brace group that opens just before `start`. */
function group(text: string, start: number): { value: string; end: number } {
  let depth = 1;
  for (let at = start; at < text.length; at += 1) {
    if (text[at] === '\\') at += 1;
    else if (text[at] === '{') depth += 1;
    else if (text[at] === '}' && --depth === 0) return { value: text.slice(start, at), end: at + 1 };
  }
  return { value: text.slice(start), end: text.length };
}

/**
 * A float's main caption and its \label: the last \caption (the whole figure's, after any subfigures') and
 * the first label after it, else the last label of the source.
 */
export function captionAndLabel(source: string): { caption?: string; label?: string } {
  const text = stripComments(source);
  let caption: { value: string; end: number } | undefined;
  for (const match of text.matchAll(/\\caption(?![A-Za-z@])\s*(?:\[[^\]]*\]\s*)?\{/g)) {
    caption = group(text, (match.index ?? 0) + match[0].length);
  }
  const labels = [...text.matchAll(/\\label\s*\{([^{}]*)\}/g)];
  const after = caption ? labels.find((match) => (match.index ?? 0) >= caption!.end) : undefined;
  const label = (after ?? labels[labels.length - 1])?.[1].trim();
  return { ...(caption ? { caption: caption.value.trim() } : {}), ...(label ? { label } : {}) };
}

/**
 * A figure's or table's code started over as the other kind: the new kind's starting code (an empty table the
 * visual editor opens, or a figure waiting for its image) with the caption and \label kept, so \ref to the
 * block still works. The content itself is the owner's to supply.
 */
export function convertedSource(source: string, to: FloatKind): string {
  const { caption, label } = captionAndLabel(source);
  if (to === 'table') return serializeTable({ ...createTable(), caption: caption ?? '', label: label ?? '' });
  return BLOCK_TEMPLATES.figure()
    .replace('\\caption{Caption.}', () => `\\caption{${caption ?? 'Caption.'}}`)
    .replace('\\label{fig:}', () => `\\label{${label ?? 'fig:'}}`);
}

/**
 * The block turned into the other kind: the version kept from an earlier turn, with its PDF, if it has one,
 * else that kind's starting code (convertedSource). The version it replaces is kept in turn, with its PDF, so
 * turning back loses nothing and need not compile again.
 */
export function convertedBlock(block: ResultBlock, to: FloatKind): ResultBlock {
  if (block.kind === to || block.kind === 'text') return block;
  const { output, alternate, ...rest } = block;
  const source = block.source ?? '';
  const kept = alternate?.kind === to ? alternate : undefined;
  return {
    ...rest,
    kind: to,
    source: kept ? kept.source : convertedSource(source, to),
    ...(kept?.output ? { output: kept.output } : {}),
    alternate: { kind: block.kind, source, ...(output ? { output } : {}) },
  };
}

/**
 * The edit that turns a figure or table into its kept version without the editor: its code and, when it was
 * compiled before, its PDF, so the page can show it at once. The rebuild that follows the edit compiles it
 * again only if the paper changed since, and renumbers the blocks after it. Null without a kept version.
 */
export function switchedOp(paperId: string, block: ResultBlock): ResultsOp | null {
  if (!block.alternate) return null;
  const next = convertedBlock(block, block.alternate.kind);
  const put: ResultsOp = { kind: 'putBlock', paperId, block: next };
  if (!next.output) return put;
  return { kind: 'batch', ops: [put, { kind: 'setOutputs', paperId, outputs: { [block.id]: next.output }, sources: { [block.id]: next.source ?? '' } }] };
}

/**
 * Attachments among `names` that a block's kept version uses (named with or without the extension, as
 * \includegraphics allows), each with that block's number counting from 1. No compile checks them, since the
 * kept version is not shown.
 */
export function filesKeptVersionsUse(blocks: ResultBlock[], names: string[]): { name: string; n: number }[] {
  return names.flatMap((name) => {
    const stem = name.replace(/\.[^.]+$/, '');
    const index = blocks.findIndex((block) => block.alternate !== undefined && stripComments(block.alternate.source).includes(stem));
    return index < 0 ? [] : [{ name, n: index + 1 }];
  });
}
