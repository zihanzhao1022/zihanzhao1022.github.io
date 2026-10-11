import { useCallback, useEffect, useState } from 'react';
import { COMMENT_LIMITS } from '../../../lib/comments';
import { contextAround } from './commentText';

/** The text of a PDF's text layer as comments quote it (single spaces), and where each character sits. */
export interface LayerText {
  text: string;
  /** The text node and offset of each character of `text`. */
  at: { node: Text; offset: number }[];
  /** For each text node, the index in `text` of each of its offsets and of its end. */
  index: Map<Text, number[]>;
}

/** A rectangle relative to the text layer. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function layerText(layer: HTMLElement): LayerText {
  const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let text = '';
  const at: LayerText['at'] = [];
  const index = new Map<Text, number[]>();
  let space = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType !== Node.TEXT_NODE) {
      // pdf.js ends each line with a <br>.
      if ((node as Element).tagName === 'BR') space = true;
      continue;
    }
    const textNode = node as Text;
    const positions: number[] = [];
    for (let offset = 0; offset < textNode.data.length; offset += 1) {
      const char = textNode.data[offset];
      if (/\s/.test(char)) {
        space = true;
        positions.push(text.length);
        continue;
      }
      if (space && text) {
        text += ' ';
        at.push({ node: textNode, offset });
      }
      space = false;
      positions.push(text.length);
      text += char;
      at.push({ node: textNode, offset });
    }
    positions.push(text.length);
    index.set(textNode, positions);
  }
  return { text, at, index };
}

/** The index in the layer's text of a selection boundary. */
export function boundaryIndex(layer: LayerText, container: Node, offset: number): number {
  if (container.nodeType === Node.TEXT_NODE) {
    const positions = layer.index.get(container as Text);
    if (positions) return positions[Math.min(offset, positions.length - 1)];
  }
  // Between elements: the first text that follows.
  const boundary = document.createRange();
  boundary.setStart(container, offset);
  for (const [node, positions] of layer.index) if (boundary.comparePoint(node, 0) >= 0) return positions[0];
  return layer.text.length;
}

/** Where characters start to end of the layer's text are drawn, relative to the layer. */
export function quoteBoxes(element: HTMLElement, layer: LayerText, start: number, end: number): Box[] {
  const first = layer.at[start];
  const last = layer.at[end - 1];
  if (!first || !last) return [];
  const range = document.createRange();
  range.setStart(first.node, first.offset);
  range.setEnd(last.node, last.offset + 1);
  const origin = element.getBoundingClientRect();
  const seen = new Set<string>();
  const boxes: Box[] = [];
  for (const rect of Array.from(range.getClientRects())) {
    if (rect.width < 0.5 || rect.height < 0.5) continue;
    const box = { left: rect.left - origin.left, top: rect.top - origin.top, width: rect.width, height: rect.height };
    // A range lists a span it covers whole and its text alike.
    const key = [box.left, box.top, box.width, box.height].map(Math.round).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    boxes.push(box);
  }
  return boxes;
}

/** Text selected in one block's PDF, as a new comment would quote it. */
export interface SelectedQuote {
  block: string;
  quote: string;
  prefix: string;
  suffix: string;
  /** Where the selection ends, in page coordinates, for the button that comments on it. */
  x: number;
  y: number;
}

const layerOf = (node: Node): HTMLElement | null =>
  (node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement)?.closest<HTMLElement>('.textLayer') ?? null;

/** Watches the selection: text selected inside one block's PDF in `area` can be commented on. */
export function useSelectedQuote(area: { readonly current: HTMLElement | null }, enabled: boolean): [SelectedQuote | null, () => void] {
  const [selected, setSelected] = useState<SelectedQuote | null>(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = () => {
      const selection = window.getSelection();
      const root = area.current;
      if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !root) return setSelected(null);
      const range = selection.getRangeAt(0);
      const element = layerOf(range.startContainer);
      const block = element?.closest<HTMLElement>('[data-result-block-id]')?.dataset.resultBlockId;
      if (!element || !block || element !== layerOf(range.endContainer) || !root.contains(element)) return setSelected(null);
      const layer = layerText(element);
      let start = boundaryIndex(layer, range.startContainer, range.startOffset);
      let end = boundaryIndex(layer, range.endContainer, range.endOffset);
      while (start < end && layer.text[start] === ' ') start += 1;
      while (end > start && layer.text[end - 1] === ' ') end -= 1;
      if (end <= start) return setSelected(null);
      const rect = range.getBoundingClientRect();
      const quote = contextAround(layer.text, start, Math.min(end, start + COMMENT_LIMITS.quote));
      return setSelected({ block, ...quote, x: rect.right + window.scrollX, y: rect.bottom + window.scrollY });
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(read, 150);
    };
    document.addEventListener('selectionchange', schedule);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('selectionchange', schedule);
    };
  }, [area, enabled]);
  const clear = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSelected(null);
  }, []);
  return [selected, clear];
}
