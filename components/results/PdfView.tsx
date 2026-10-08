import React, { useEffect, useRef, useState } from 'react';
import type { PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist';
import { loadPdfjs } from './pdfjs';
import { renderPdfLinks } from './pdfLinks';
import { citationId, destinationPoint, finishCitationNavigation, navigateCitation, referencesId } from './pdfDestinations';
import './pdfView.css';

/** CSS pixels per PDF point at full size: 10pt text comes out about as large as the site's body text. */
export const PDF_SCALE = 1.25 * (4 / 3);

interface Props {
  /** PDF bytes: a fresh compile, or a private file read through the GitHub API. */
  data?: Uint8Array;
  /** Or the address of a published file. */
  url?: string;
  /** Page size in points, so the space is reserved before the PDF arrives. */
  width: number;
  height: number;
  className?: string;
  onError?: (message: string) => void;
  /** Shared by a paper's blocks; editor previews use a separate scope. */
  citationScope?: string;
  /** This PDF contains the actual bibliography destinations, rather than body citations. */
  citationTargets?: boolean;
}

/** The first page of a PDF, at PDF_SCALE or narrower to fit, with selectable text and links. */
const PdfView: React.FC<Props> = ({ data, url, width, height, className = '', onError, citationScope, citationTargets = false }) => {
  const frame = useRef<HTMLDivElement>(null);
  const layers = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const errorRef = useRef(onError);
  errorRef.current = onError;

  useEffect(() => {
    const element = frame.current;
    if (!element) return undefined;
    const measure = () => setAvailable(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = available ? Math.min(PDF_SCALE, available / width) : PDF_SCALE;

  useEffect(() => {
    const target = layers.current;
    if (!target || !available || (!data && !url)) return undefined;
    let cancelled = false;
    let loading: PDFDocumentLoadingTask | null = null;
    let task: RenderTask | null = null;
    setFailed(false);
    (async () => {
      const pdfjs = await loadPdfjs();
      if (cancelled) return;
      loading = pdfjs.getDocument(data ? { data: data.slice() } : { url });
      const doc = await loading.promise;
      const page = await doc.getPage(1);
      if (cancelled) return;
      const ratio = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvas.style.display = 'block';
      task = page.render({ canvas, viewport: page.getViewport({ scale: scale * ratio }) });
      await task.promise;
      if (cancelled) return;
      const text = document.createElement('div');
      text.className = 'textLayer';
      text.style.setProperty('--scale-factor', String(scale));
      text.style.setProperty('--total-scale-factor', String(scale));
      await new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: text, viewport }).render();
      const destinations = document.createElement('div');
      destinations.className = 'resultsPdfDestinations';
      if (citationTargets && citationScope) {
        for (const [name, destination] of await doc.getDestinations()) {
          if (!name.startsWith('cite.')) continue;
          const marker = document.createElement('span');
          marker.id = citationId(citationScope, name);
          marker.className = 'resultsPdfDestination';
          marker.tabIndex = -1;
          marker.setAttribute('aria-label', `参考文献 ${name.slice(5)}`);
          marker.style.top = `${destinationPoint(destination, viewport).top}px`;
          destinations.append(marker);
        }
      }
      const annotations = await page.getAnnotations({ intent: 'display' });
      const names = [...new Set<string>(annotations.map((annotation) => annotation.dest).filter((name): name is string => typeof name === 'string' && !name.startsWith('cite.')))];
      const unresolved = new Set((await Promise.all(names.map(async (name) => {
        const destination = await doc.getDestination(name);
        // pdfTeX fabricates a page-wide /Fit destination for a cross-block target it
        // cannot find. Only citations currently have a destination in another PDF.
        return !destination || destination[1]?.name === 'Fit' ? name : null;
      }))).filter((name): name is string => name !== null));
      const links = renderPdfLinks({
        annotations: annotations.filter((annotation) => !unresolved.has(annotation.dest)),
        viewport,
        onDestination: (destination) => {
          if (typeof destination === 'string' && destination.startsWith('cite.') && citationScope) {
            navigateCitation(citationScope, destination);
            return;
          }
          void (async () => {
            const resolved = typeof destination === 'string' ? await doc.getDestination(destination) : destination;
            if (!resolved || cancelled) return;
            const pageRef = resolved[0];
            const samePage = pageRef === 0 || (pageRef && typeof pageRef === 'object' && 'num' in pageRef && 'gen' in pageRef && pageRef.num === page.ref?.num && pageRef.gen === page.ref?.gen);
            if (!samePage) return;
            const marker = document.createElement('span');
            marker.className = 'resultsPdfDestination resultsPdfLocalDestination';
            marker.tabIndex = -1;
            marker.style.top = `${destinationPoint(resolved, viewport).top}px`;
            destinations.querySelector('.resultsPdfLocalDestination')?.remove();
            destinations.append(marker);
            marker.scrollIntoView({ block: 'start' });
            marker.focus({ preventScroll: true });
          })().catch(() => undefined);
        },
      });
      if (!cancelled) {
        target.replaceChildren(canvas, text, destinations, links);
        if (citationTargets && citationScope) finishCitationNavigation(citationScope);
      }
    })().catch((error: unknown) => {
      if (cancelled || (error instanceof Error && error.name === 'RenderingCancelledException')) return;
      setFailed(true);
      errorRef.current?.('PDF 显示失败');
    });
    return () => {
      cancelled = true;
      task?.cancel();
      void loading?.destroy();
    };
  }, [data, url, scale, available, citationScope, citationTargets]);

  return (
    <div ref={frame} id={citationTargets && citationScope ? referencesId(citationScope) : undefined} className={`w-full ${className}`}>
      <div className="relative mx-auto bg-white" style={{ width: width * scale, height: height * scale }}>
        <div ref={layers} className="absolute inset-0" />
        {failed && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">PDF 显示失败</div>
        )}
      </div>
    </div>
  );
};

export default PdfView;
