import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useT } from '../../../lib/phrases/site';
import { CommentOp, ResultComment } from '../../../types';
import { CommentBox, CommentCard } from './CommentCard';
import { placeCards } from './commentText';

/** A comment being written: on a block, or on text selected in it. */
export interface DraftComment {
  block: string;
  quote?: string;
  prefix?: string;
  suffix?: string;
  /** Where the selection ended, in page coordinates, to put the box beside it. */
  y?: number;
}

interface Props {
  /** The threads to show, open ones and resolved ones when those are shown. */
  threads: ResultComment[];
  /** Block IDs top to bottom, to order the threads. */
  order: string[];
  draft: DraftComment | null;
  focused: string | null;
  resolvedCount: number;
  showResolved: boolean;
  onToggleResolved: () => void;
  /** Beside the text: the panel's own container and the text's, so cards line up with what they discuss. */
  aligned?: { column: HTMLElement | null; content: HTMLElement | null };
  meId?: number;
  owner: boolean;
  connected: boolean;
  onFocus: (id: string) => void;
  onPost: (text: string) => void;
  onCancelDraft: () => void;
  onClose: () => void;
  act: (op: CommentOp) => void;
}

const GAP = 12;
/** The comment being written, as a card and as the highlight of the text it quotes. */
export const DRAFT = 'draft';

/** The comments of a paper: beside the text on wide screens, a list in a drawer elsewhere. */
const CommentsPanel: React.FC<Props> = ({
  threads,
  order,
  draft,
  focused,
  resolvedCount,
  showResolved,
  onToggleResolved,
  aligned,
  meId,
  owner,
  connected,
  onFocus,
  onPost,
  onCancelDraft,
  onClose,
  act,
}) => {
  const t = useT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const rank = (block: string) => {
    const index = order.indexOf(block);
    return index === -1 ? order.length : index;
  };
  const sorted = [...threads].sort((a, b) => rank(a.block) - rank(b.block) || a.at - b.at);

  // Beside the text: each card at the height of what it discusses, pushed down where cards would overlap.
  const cards = useRef(new Map<string, HTMLElement>());
  const area = useRef<HTMLDivElement>(null);
  const [tops, setTops] = useState<Record<string, number>>({});
  const [, setTick] = useState(0);
  const column = aligned?.column ?? null;
  const content = aligned?.content ?? null;
  const ids = [...(draft ? [DRAFT] : []), ...sorted.map((thread) => thread.id)].join(' ');
  useEffect(() => {
    if (!column) return undefined;
    let frame = 0;
    const again = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setTick((value) => value + 1));
    };
    // PDFs drawing, a reply box opening and the window resizing all move the cards.
    const observer = new ResizeObserver(again);
    if (content) observer.observe(content);
    cards.current.forEach((card) => observer.observe(card));
    window.addEventListener('resize', again);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', again);
    };
  }, [column, content, ids]);
  useLayoutEffect(() => {
    if (!column || !area.current) return;
    // Measured from where the cards sit, below the panel's header.
    const origin = area.current.getBoundingClientRect().top;
    // The highlighted text a card discusses, else where the selection was, else its block.
    const anchor = (id: string, block: string, y?: number): number => {
      const mark = document.querySelector(`[data-comment-highlight="${CSS.escape(id)}"]`);
      if (mark) return mark.getBoundingClientRect().top - origin;
      if (y !== undefined) return y - window.scrollY - origin;
      const target = document.querySelector(`[data-result-block-id="${CSS.escape(block)}"]`);
      return target ? target.getBoundingClientRect().top - origin : Number.POSITIVE_INFINITY;
    };
    const items = [
      ...(draft ? [{ id: DRAFT, top: anchor(DRAFT, draft.block, draft.y) }] : []),
      ...sorted.map((thread) => ({ id: thread.id, top: anchor(thread.id, thread.block) })),
    ].map((item) => ({ ...item, height: cards.current.get(item.id)?.offsetHeight ?? 96 }));
    const shown = items.filter((item) => Number.isFinite(item.top)).sort((a, b) => a.top - b.top);
    // Threads whose block is not on the page (hidden or deleted) go last.
    const end = shown.length > 0 ? shown[shown.length - 1].top : 0;
    const lost = items.filter((item) => !Number.isFinite(item.top)).map((item) => ({ ...item, top: end }));
    const placed = placeCards([...shown, ...lost], GAP, focused ?? (draft ? DRAFT : null));
    const lowest = Math.min(0, ...Object.values(placed));
    const next = Object.fromEntries(Object.entries(placed).map(([id, top]) => [id, Math.round(top - lowest)]));
    if (JSON.stringify(next) !== JSON.stringify(tops)) setTops(next);
  });

  const keep = (id: string) => (element: HTMLElement | null) => {
    if (element) cards.current.set(id, element);
    else cards.current.delete(id);
  };
  const place = (id: string): React.CSSProperties | undefined =>
    column ? { position: 'absolute', left: 0, right: 0, top: tops[id] ?? 0, visibility: id in tops ? 'visible' : 'hidden' } : undefined;
  const bottom = Math.max(0, ...Object.entries(tops).map(([id, top]) => top + (cards.current.get(id)?.offsetHeight ?? 0)));

  const header = (
    <div className={`flex items-center gap-2 text-xs text-gray-500 ${column ? 'sticky top-24 z-10 -mx-1 rounded-md bg-white/90 px-1 py-1 backdrop-blur-sm' : 'mb-3'}`}>
      <span className="font-medium text-gray-700">{t('批注')}</span>
      <span>{threads.filter((thread) => !thread.resolved).length}</span>
      {resolvedCount > 0 && (
        <button type="button" onClick={onToggleResolved} className="ml-2 hover:text-purple-700">
          {showResolved ? t('隐藏已解决') : t('显示已解决（{n}）', { n: resolvedCount })}
        </button>
      )}
      <button type="button" onClick={onClose} aria-label={t('收起批注')} className="ml-auto p-1 text-gray-400 hover:text-gray-700">
        <X size={14} />
      </button>
    </div>
  );

  const draftCard = draft && (
    <div ref={keep(DRAFT)} style={place(DRAFT)} className="rounded-lg border border-purple-300 bg-white p-3 text-sm shadow-md ring-2 ring-purple-100">
      {draft.quote && <blockquote className="line-clamp-3 border-l-2 border-amber-300 pl-2 text-xs text-gray-500">{draft.quote}</blockquote>}
      <CommentBox placeholder={draft.quote ? t('对这段文字的批注…') : t('对这一块的批注…')} submit={t('发布')} connected={connected} onSubmit={onPost} onCancel={onCancelDraft} />
    </div>
  );

  const list = sorted.map((thread) => (
    <div key={thread.id} ref={keep(thread.id)} style={place(thread.id)}>
      <CommentCard
        thread={thread}
        meId={meId}
        owner={owner}
        focused={thread.id === focused}
        connected={connected}
        now={now}
        onFocus={() => onFocus(thread.id)}
        act={act}
      />
    </div>
  ));

  if (column) {
    return (
      <div>
        {header}
        <div ref={area} className="relative" style={{ minHeight: bottom + GAP }}>
          {draftCard}
          {list}
        </div>
        {threads.length === 0 && !draft && <p className="mt-2 text-xs text-gray-400">{t('选中 PDF 里的文字，或点块右上角的批注图标，就能添加批注。')}</p>}
      </div>
    );
  }
  return (
    <div>
      {header}
      <div className="space-y-3">
        {draftCard}
        {list}
      </div>
      {threads.length === 0 && !draft && <p className="text-xs text-gray-400">{t('选中 PDF 里的文字，或点块右上角的批注图标，就能添加批注。')}</p>}
    </div>
  );
};

export default CommentsPanel;
