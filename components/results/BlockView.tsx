import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useT } from '../../lib/phrases/site';
import { publicFilePath } from '../../lib/results';
import { ResultBlock } from '../../types';
import { readsPrivately, useResultsAccess } from './access';
import { findQuote } from './comments/commentText';
import { Box, layerText, quoteBoxes } from './comments/textLayer';
import PdfView from './PdfView';

/** A comment on text of this block, to highlight. */
export interface QuoteMark {
  id: string;
  quote: string;
  prefix?: string;
  suffix?: string;
}

interface Props {
  paperId: string;
  block: ResultBlock;
  references?: boolean;
  /** Commented text to highlight; a quote no longer in the PDF is not marked. */
  quotes?: QuoteMark[];
  /** The comment being looked at, highlighted more strongly. */
  activeQuote?: string | null;
  onQuoteClick?: (id: string) => void;
}

/** A block's compiled PDF: read privately by the signed-in editor, or from the site for visitors. */
const BlockView: React.FC<Props> = ({ paperId, block, references = false, quotes, activeQuote, onQuoteClick }) => {
  const access = useResultsAccess();
  const t = useT();
  const output = block.output;
  const isPrivate = readsPrivately(access, paperId);
  const [data, setData] = useState<Uint8Array | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  const [marks, setMarks] = useState<{ id: string; boxes: Box[] }[]>([]);
  // The marks depend on the quotes' text, not on the array the page builds again on every update.
  const quotesKey = JSON.stringify(quotes ?? []);
  const wanted = useMemo(() => JSON.parse(quotesKey) as QuoteMark[], [quotesKey]);

  useLayoutEffect(() => {
    if (!layer || wanted.length === 0) {
      setMarks([]);
      return;
    }
    const text = layerText(layer);
    setMarks(
      wanted.flatMap((mark) => {
        const found = findQuote(text.text, mark.quote, mark.prefix, mark.suffix);
        return found ? [{ id: mark.id, boxes: quoteBoxes(layer, text, found.start, found.end) }] : [];
      }),
    );
  }, [layer, wanted]);

  // Highlights let clicks through to the text and links; a click on one (not ending a selection) opens its comment.
  const clickMark = (event: React.MouseEvent) => {
    if (!onQuoteClick || !layer || marks.length === 0 || !window.getSelection()?.isCollapsed) return;
    const origin = layer.getBoundingClientRect();
    const x = event.clientX - origin.left;
    const y = event.clientY - origin.top;
    const hit = marks.find((mark) => mark.boxes.some((box) => x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height));
    if (hit) onQuoteClick(hit.id);
  };

  useEffect(() => {
    if (!isPrivate || !output || !access) return undefined;
    let cancelled = false;
    setData(undefined);
    setFailed(false);
    access
      .readFile(output.pdf)
      .then((bytes) => {
        if (!cancelled) setData(bytes);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isPrivate, output, access]);

  if (!output) {
    return <div className="py-8 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded">{t('还没有编译')}</div>;
  }
  if (failed) {
    return <div className="py-8 text-center text-sm text-red-500 border border-dashed border-red-200 rounded">{t('读取 PDF 失败，请刷新页面重试')}</div>;
  }
  return (
    <div onClick={clickMark}>
      <PdfView
        data={isPrivate ? data : undefined}
        url={isPrivate ? undefined : publicFilePath(output.pdf)}
        width={output.width}
        height={output.height}
        citationScope={paperId}
        citationTargets={references}
        onTextLayer={setLayer}
      >
        {marks.map((mark) =>
          mark.boxes.map((box, index) => (
            <span
              key={`${mark.id}-${index}`}
              data-comment-highlight={mark.id}
              className={`pointer-events-none absolute rounded-sm mix-blend-multiply ${mark.id === activeQuote ? 'bg-amber-300/80' : 'bg-yellow-200/70'}`}
              style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
            />
          )),
        )}
      </PdfView>
    </div>
  );
};

export default BlockView;
