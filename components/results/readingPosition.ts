import { useEffect } from 'react';

/** Where a block is relative to the window, as getBoundingClientRect gives it. */
export interface BlockBox {
  id: string;
  top: number;
  bottom: number;
}

/** The block someone is looking at: the one with the most of itself on screen (the upper one on a tie). */
export function blockInView(boxes: BlockBox[], windowHeight: number): string | null {
  let best: string | null = null;
  let most = 0;
  for (const box of boxes) {
    const shown = Math.min(box.bottom, windowHeight) - Math.max(box.top, 0);
    if (shown > most) {
      most = shown;
      best = box.id;
    }
  }
  return best;
}

/** How long scrolling has to pause before the new place counts, so fast scrolling sends nothing. */
const SETTLE_MS = 400;

/**
 * Tells `report` which block inside `area` (elements with data-result-block-id) is on screen, each time that
 * changes once scrolling and layout have settled. Starts over for each paper.
 */
export function useReportBlockInView(
  area: { readonly current: HTMLElement | null },
  report: ((blockId: string | null) => void) | undefined,
  paperId: string | undefined,
): void {
  useEffect(() => {
    const root = area.current;
    if (!report || !root) return undefined;
    let last: string | null | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const measure = () => {
      const boxes = Array.from(root.querySelectorAll<HTMLElement>('[data-result-block-id]'), (element) => {
        const { top, bottom } = element.getBoundingClientRect();
        return { id: element.dataset.resultBlockId ?? '', top, bottom };
      });
      const block = blockInView(boxes, window.innerHeight);
      if (block === last) return;
      last = block;
      report(block);
    };
    const settle = () => {
      clearTimeout(timer);
      timer = setTimeout(measure, SETTLE_MS);
    };
    settle();
    window.addEventListener('scroll', settle, { passive: true });
    window.addEventListener('resize', settle);
    // Blocks grow as their PDFs draw, which moves the others without any scrolling.
    const resized = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(settle);
    resized?.observe(root);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', settle);
      window.removeEventListener('resize', settle);
      resized?.disconnect();
    };
  }, [area, report, paperId]);
}
