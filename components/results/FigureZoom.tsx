import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useT } from '../../lib/phrases/site';
import PdfView from './PdfView';
import { PageBox } from './pictures';

interface Props {
  /** The figure's PDF, as the page has it: private bytes or the published file's address. */
  data?: Uint8Array;
  url?: string;
  /** Page size in points. */
  width: number;
  height: number;
  /** Only this part of the page: a picture of a text block. */
  region?: PageBox;
  onClose: () => void;
}

/**
 * A figure, or a picture of a text block, enlarged over the page: drawn again as large as the window allows
 * (so it stays sharp). A click around it, Esc or the close button puts it back.
 */
const FigureZoom: React.FC<Props> = ({ data, url, width, height, region, onClose }) => {
  const t = useT();
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    // Into the dialog for the keyboard, without marking the close button as if it had been tabbed to.
    dialog.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
      previousFocus?.focus({ preventScroll: true });
    };
  }, [onClose]);

  return createPortal(
    // Clicks stay here: in React they would also reach the block the figure came from.
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={t('放大的图')}
      tabIndex={-1}
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
      className="resultsFigureZoom fixed inset-0 z-[100] flex items-center justify-center bg-black/70 outline-none"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t('关闭')}
        className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-gray-600 shadow hover:text-gray-900"
      >
        <X size={20} />
      </button>
      {/* As wide as fits in 95% of the window's width and 90% of its height. */}
      <div
        onClick={(event) => event.stopPropagation()}
        className="cursor-auto bg-white p-3 shadow-2xl"
        style={{ width: `min(95vw, calc(90vh * ${region ? region.width / region.height : width / height}))` }}
      >
        <PdfView data={data} url={url} width={width} height={height} region={region} maxScale={Infinity} />
      </div>
    </div>,
    document.body,
  );
};

export default FigureZoom;
