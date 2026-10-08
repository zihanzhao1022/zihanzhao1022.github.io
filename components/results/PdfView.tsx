import React, { useEffect, useRef, useState } from 'react';
import type { PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist';
import { loadPdfjs } from './pdfjs';
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
}

/** The first page of a PDF, at PDF_SCALE or narrower to fit, with selectable text. */
const PdfView: React.FC<Props> = ({ data, url, width, height, className = '', onError }) => {
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
      if (!cancelled) target.replaceChildren(canvas, text);
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
  }, [data, url, scale, available]);

  return (
    <div ref={frame} className={`w-full ${className}`}>
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
