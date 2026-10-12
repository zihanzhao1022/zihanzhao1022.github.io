import { stripComments } from '../tex/document';
import { BLOCK_TEMPLATES } from './actions';
import { createTable } from './table/model';
import { serializeTable } from './table/latex';

/** The kinds a block can be turned into each other. */
export type FloatKind = 'figure' | 'table';

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
