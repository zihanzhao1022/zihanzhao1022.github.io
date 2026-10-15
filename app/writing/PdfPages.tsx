import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PageViewport } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { loadPdfjs, openPdf } from '../../components/results/pdfjs';
import { renderPdfLinks } from '../../components/results/pdfLinks';
import '../../components/results/pdfView.css';
import { Hit } from './document';

/** A double click in the PDF: where (see Hit), the word under it and the text of its line. */
export interface PdfClick extends Hit {
  word: string;
  context: string;
}

export interface PdfPagesHandle {
  /** Scrolls to a point (PDF points from the page's bottom left) and marks it for a moment. */
  show: (page: number, y: number) => void;
}

interface Props {
  data?: Uint8Array;
  /** 1 fits the pages to the pane's width. */
  zoom: number;
  onDoubleClick: (click: PdfClick) => void;
}

interface Size {
  width: number;
  height: number;
}

const GAP = 12;

/** The word of a line of text at a horizontal position, by the share of the line's width it is at. */
function wordAt(text: string, share: number): string {
  const at = Math.max(0, Math.min(text.length - 1, Math.floor(share * text.length)));
  const isWord = (char: string) => /[\p{L}\p{N}\-']/u.test(char);
  let start = at;
  let end = at;
  while (start > 0 && isWord(text[start - 1])) start -= 1;
  while (end < text.length && isWord(text[end])) end += 1;
  return text.slice(start, end);
}

/** One page: drawn (canvas, text, links) once it comes near the screen, and again when the PDF or scale changes. */
const Page: React.FC<{
  doc: PDFDocumentProxy;
  number: number;
  size: Size;
  scale: number;
  root: HTMLElement | null;
  onLink: (page: number, y: number) => void;
  onDoubleClick: (click: PdfClick) => void;
  flash: number | null;
}> = ({ doc, number, size, scale, root, onLink, onDoubleClick, flash }) => {
  const frame = useRef<HTMLDivElement>(null);
  const layers = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const viewport = useRef<PageViewport | null>(null);
  const items = useRef<TextItem[]>([]);

  useEffect(() => {
    const element = frame.current;
    if (!element) return undefined;
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { root, rootMargin: '150% 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [root]);

  useEffect(() => {
    const target = layers.current;
    if (!near || !target) return undefined;
    let cancelled = false;
    (async () => {
      const pdfjs = await loadPdfjs();
      const page = await doc.getPage(number);
      if (cancelled) return;
      const ratio = window.devicePixelRatio || 1;
      const view = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(view.width * ratio);
      canvas.height = Math.floor(view.height * ratio);
      canvas.style.width = `${view.width}px`;
      canvas.style.height = `${view.height}px`;
      canvas.style.display = 'block';
      await page.render({ canvas, viewport: page.getViewport({ scale: scale * ratio }) }).promise;
      if (cancelled) return;
      const content = await page.getTextContent();
      const text = document.createElement('div');
      text.className = 'textLayer';
      text.style.setProperty('--scale-factor', String(scale));
      text.style.setProperty('--total-scale-factor', String(scale));
      await new pdfjs.TextLayer({ textContentSource: content, container: text, viewport: view }).render();
      const links = renderPdfLinks({
        annotations: await page.getAnnotations({ intent: 'display' }),
        viewport: view,
        onDestination: (destination) => {
          void (async () => {
            const resolved = typeof destination === 'string' ? await doc.getDestination(destination) : destination;
            if (!resolved || !resolved[0] || typeof resolved[0] !== 'object') return;
            const index = await doc.getPageIndex(resolved[0] as { num: number; gen: number });
            const y = typeof resolved[3] === 'number' ? resolved[3] : size.height;
            onLink(index + 1, y);
          })().catch(() => undefined);
        },
      });
      if (cancelled) return;
      viewport.current = view;
      items.current = content.items.filter((item): item is TextItem => 'str' in item);
      target.replaceChildren(canvas, text, links);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [doc, number, scale, near, size.height, onLink]);

  const doubleClick = (event: React.MouseEvent) => {
    const view = viewport.current;
    const box = frame.current?.getBoundingClientRect();
    if (!view || !box) return;
    const [x, y] = view.convertToPdfPoint(event.clientX - box.left, event.clientY - box.top) as [number, number];
    // The text item under the click: its baseline, its line and the word at the click.
    const under = items.current.find((item) => {
      const [, , , d, e, f] = item.transform as number[];
      const height = item.height || Math.abs(d) || 10;
      return x >= e - 1 && x <= e + item.width + 1 && y >= f - height * 0.3 && y <= f + height;
    });
    const baseline = under ? (under.transform as number[])[5] : undefined;
    const line = baseline === undefined ? '' : items.current
      .filter((item) => Math.abs((item.transform as number[])[5] - baseline) < 1)
      .sort((a, b) => (a.transform as number[])[4] - (b.transform as number[])[4])
      .map((item) => item.str)
      .join(' ');
    // The word the browser selected on the page; a selection elsewhere (the editor's) says nothing about the click.
    const selection = window.getSelection();
    const selected = selection && frame.current?.contains(selection.anchorNode) ? selection.toString().trim() : '';
    const computed = under ? wordAt(under.str, (x - (under.transform as number[])[4]) / (under.width || 1)) : '';
    const word = selected && !/\s/.test(selected) ? selected : computed;
    onDoubleClick({ page: number, x, y, baseline, pageWidth: size.width, word, context: line });
  };

  return (
    <div
      ref={frame}
      data-page={number}
      onDoubleClick={doubleClick}
      className="relative mx-auto bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12),0_8px_24px_-12px_rgba(0,0,0,0.25)]"
      style={{ width: size.width * scale, height: size.height * scale }}
    >
      <div ref={layers} className="absolute inset-0" />
      {flash !== null && (
        <div
          aria-hidden="true"
          className="writing-flash pointer-events-none absolute inset-x-0 h-6 -translate-y-1/2 bg-violet-400/25"
          style={{ top: (size.height - flash) * scale }}
        />
      )}
    </div>
  );
};

/** Every page of a PDF, one under another, fitted to the pane and drawn as they come near the screen. */
const PdfPages = React.forwardRef<PdfPagesHandle, Props>(function PdfPages({ data, zoom, onDoubleClick }, ref) {
  const scroller = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const task = useRef<PDFDocumentLoadingTask | null>(null);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [width, setWidth] = useState(0);
  const [flash, setFlash] = useState<{ page: number; y: number; key: number } | null>(null);

  useEffect(() => {
    const element = scroller.current;
    if (!element) return undefined;
    const measure = () => setWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // A new PDF replaces the old one only once it is open, so the pane never goes blank while compiling.
  useEffect(() => {
    if (!data) return undefined;
    let cancelled = false;
    (async () => {
      const loading = await openPdf({ data: data.slice() });
      const next = await loading.promise;
      const pages = await Promise.all(Array.from({ length: next.numPages }, (_, index) => next.getPage(index + 1)));
      if (cancelled) {
        void loading.destroy();
        return;
      }
      setSizes(pages.map((page) => page.getViewport({ scale: 1 })).map(({ width: w, height: h }) => ({ width: w, height: h })));
      // The previous document is let go once the new one is on screen.
      const previous = task.current;
      task.current = loading;
      setDoc(next);
      window.setTimeout(() => void previous?.destroy(), 1000);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [data]);

  const widest = Math.max(1, ...sizes.map((size) => size.width));
  const scale = (Math.max(200, width - 2 * GAP) / widest) * zoom;

  const show = useCallback(
    (page: number, y: number) => {
      const element = scroller.current;
      const target = element?.querySelector<HTMLElement>(`[data-page="${page}"]`);
      const size = sizes[page - 1];
      if (!element || !target || !size) return;
      const top = target.offsetTop + (size.height - y) * scale;
      element.scrollTo({ top: Math.max(0, top - element.clientHeight / 3), behavior: 'smooth' });
      setFlash({ page, y, key: Date.now() });
    },
    [sizes, scale],
  );

  useImperativeHandle(ref, () => ({ show }), [show]);

  useEffect(() => {
    if (!flash) return undefined;
    const timer = window.setTimeout(() => setFlash(null), 1600);
    return () => window.clearTimeout(timer);
  }, [flash]);

  return (
    <div ref={scroller} className="h-full overflow-auto bg-[#e9e9ec] py-3">
      {doc && (
        <div className="flex flex-col" style={{ gap: GAP }}>
          {sizes.map((size, index) => (
            <Page
              key={index}
              doc={doc}
              number={index + 1}
              size={size}
              scale={scale}
              root={scroller.current}
              onLink={show}
              onDoubleClick={onDoubleClick}
              flash={flash && flash.page === index + 1 ? flash.y : null}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default PdfPages;
