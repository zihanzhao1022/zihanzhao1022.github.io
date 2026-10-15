import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize, Minimize, X } from 'lucide-react';
import PdfView from '../components/results/PdfView';
import { itemAt, outlineItems } from '../components/results/outlineItems';
import { useT } from '../lib/phrases/app';
import { ResultBlockOutput, ResultPaper } from '../types';

interface Props {
  paper: ResultPaper;
  readFile: (path: string, version?: string) => Promise<Uint8Array>;
  onClose: () => void;
}

interface Slide {
  id: string;
  output: ResultBlockOutput;
}

/**
 * The paper one block at a time, as large as the screen allows, for a group meeting: arrow keys or the space
 * bar move on, Esc ends. The section the block belongs to stays at the top.
 */
const Presentation: React.FC<Props> = ({ paper, readFile, onClose }) => {
  const t = useT();
  const slides = useMemo<Slide[]>(
    () => [
      ...paper.blocks.flatMap((block) => (!block.hidden && block.output ? [{ id: block.id, output: block.output }] : [])),
      ...(paper.references ? [{ id: 'references', output: paper.references }] : []),
    ],
    [paper],
  );
  const items = useMemo(() => outlineItems(paper.blocks, (block) => !block.hidden, paper.references !== undefined, paper.preamble), [paper]);
  const order = useMemo(() => slides.map((slide) => slide.id), [slides]);
  const [at, setAt] = useState(0);
  const [pdfs, setPdfs] = useState<Record<string, Uint8Array>>({});
  const [full, setFull] = useState(false);
  const slide = slides[Math.min(at, slides.length - 1)];

  const go = useCallback((step: number) => setAt((current) => Math.max(0, Math.min(slides.length - 1, current + step))), [slides.length]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key)) go(1);
      else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) go(-1);
      else if (event.key === 'Home') setAt(0);
      else if (event.key === 'End') setAt(slides.length - 1);
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    const onFull = () => setFull(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', onFull);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFull);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [go, onClose, slides.length]);

  // This slide's PDF and the next one's, so moving on does not wait.
  useEffect(() => {
    for (const next of slides.slice(at, at + 2)) {
      if (pdfs[next.output.pdf]) continue;
      readFile(next.output.pdf).then(
        (bytes) => setPdfs((current) => ({ ...current, [next.output.pdf]: bytes })),
        () => undefined,
      );
    }
  }, [at, slides, pdfs, readFile]);

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  };

  const section = slide ? items.find((item) => item.key === itemAt(items, order, slide.id)) : undefined;

  return (
    <div role="dialog" aria-modal="true" aria-label={t('演示')} className="fixed inset-0 z-[110] flex flex-col bg-neutral-100">
      <header className="flex items-center gap-3 px-5 py-3 text-sm text-gray-600">
        <span className="font-serif-display truncate text-base text-gray-900">{paper.title}</span>
        {section && <span className="truncate text-gray-500">{section.text}</span>}
        <span className="ml-auto tabular-nums text-gray-500">
          {slides.length > 0 ? `${at + 1} / ${slides.length}` : ''}
        </span>
        <button type="button" onClick={toggleFull} aria-label={full ? t('退出全屏') : t('全屏')} title={full ? t('退出全屏') : t('全屏')} className="rounded p-1.5 hover:bg-white">
          {full ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>
        <button type="button" onClick={onClose} aria-label={t('结束演示')} title={t('结束演示（Esc）')} className="rounded p-1.5 hover:bg-white">
          <X size={18} />
        </button>
      </header>
      {/* A short block sits in the middle of the screen; a long one scrolls. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6">
        {slide ? (
          <div className="mx-auto my-auto w-full max-w-[1100px] bg-white shadow-sm">
            <PdfView key={slide.output.pdf} data={pdfs[slide.output.pdf]} width={slide.output.width} height={slide.output.height} maxScale={3} />
          </div>
        ) : (
          <p className="py-24 text-center text-gray-500">{t('这篇论文还没有能演示的块。')}</p>
        )}
      </div>
      <footer className="flex items-center justify-center gap-4 pb-4">
        <button type="button" disabled={at === 0} onClick={() => go(-1)} aria-label={t('上一块')} className="rounded-full bg-white p-2 shadow-sm disabled:opacity-30">
          <ChevronLeft size={20} />
        </button>
        <div className="h-1 w-48 overflow-hidden rounded-full bg-gray-300" aria-hidden="true">
          <div className="h-full bg-violet-600 transition-[width]" style={{ width: `${slides.length ? ((at + 1) / slides.length) * 100 : 0}%` }} />
        </div>
        <button type="button" disabled={at >= slides.length - 1} onClick={() => go(1)} aria-label={t('下一块')} className="rounded-full bg-white p-2 shadow-sm disabled:opacity-30">
          <ChevronRight size={20} />
        </button>
      </footer>
    </div>
  );
};

export default Presentation;
