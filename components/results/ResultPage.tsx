import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, ListTree, MessageSquare, MessageSquarePlus, X } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { exportPaperTex, exportTex } from '../../editor/results/texNames';
import { N_, Translate } from '../../lib/i18n';
import { useT } from '../../lib/phrases/site';
import { findPaper, shownBlocks } from '../../lib/results';
import { ResultBlock, ResultPaper } from '../../types';
import { useContent } from '../ContentContext';
import { AddButton, EditButton, EditModeContext, HiddenBadge, PILL, useEditMode } from '../EditMode';
import { SortableGroup } from '../SortableGroup';
import { ResultsAccess, canEditShared, isCollaborator, useResultsAccess } from './access';
import Authors from './Authors';
import BlockView, { QuoteMark } from './BlockView';
import CommentsPanel, { DRAFT, DraftComment } from './comments/CommentsPanel';
import { useSelectedQuote } from './comments/textLayer';
import LoginPrompt from './LoginPrompt';
import Outline from './Outline';
import { OutlineItem, itemAt, outlineItems } from './outlineItems';
import { goToHeading } from './pdfDestinations';
import { ResultsUnavailable } from './ResultsList';
import './resultPage.css';
import { Reader, avatarUrl, usePresence } from '../presence';
import { useReportBlockInView } from './readingPosition';

// Translated where shown.
const KIND_LABEL = { text: N_('文字'), figure: N_('图'), table: N_('表格') } as const;
const EDIT_LABEL = { text: N_('编辑文字'), figure: N_('编辑图'), table: N_('编辑表格') } as const;

const InsertButtons: React.FC<{ paperId: string; afterBlockId?: string }> = ({ paperId, afterBlockId }) => {
  const t = useT();
  return (
    <>
      <AddButton request={{ kind: 'block', paperId, blockKind: 'text', afterBlockId }} text={t('文字')} />
      <AddButton request={{ kind: 'block', paperId, blockKind: 'figure', afterBlockId }} text={t('图')} />
      <AddButton request={{ kind: 'block', paperId, blockKind: 'table', afterBlockId }} text={t('表格')} />
    </>
  );
};

/** Copies LaTeX to the clipboard without opening an editor; `pill` matches the labelled edit buttons beside it. */
const CopyButton: React.FC<{ text: () => string; label: string; title: string; pill?: boolean; className?: string }> = ({
  text,
  label,
  title,
  pill = false,
  className = '',
}) => {
  const t = useT();
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    if (state === 'idle') return undefined;
    const timer = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [state]);
  const copy = () => {
    navigator.clipboard.writeText(text()).then(
      () => setState('copied'),
      () => setState('failed'),
    );
  };
  return (
    <button
      type="button"
      onClick={copy}
      title={title}
      className={`${
        pill
          ? PILL
          : 'inline-flex items-center gap-1 h-8 px-2.5 rounded-full border border-gray-300 bg-white text-xs text-gray-600 shadow-sm hover:border-purple-300 hover:text-purple-700'
      } ${className}`}
    >
      {state === 'copied' ? <Check size={14} /> : <Copy size={14} />}
      {{ idle: label, copied: t('已复制'), failed: t('复制失败') }[state]}
    </button>
  );
};

/** The others looking at a block, beside it like collaborators' cursors in Overleaf. */
const BlockReaders: React.FC<{ blockId: string }> = ({ blockId }) => {
  const presence = usePresence();
  const t = useT();
  const here = presence?.viewers.filter((viewer) => viewer.block === blockId && viewer.login !== presence.me?.login) ?? [];
  if (here.length === 0) return null;
  return (
    // In the right margin: the left one holds the drag handles while editing.
    <div className="absolute z-10 -top-8 right-0 flex gap-1 md:top-0 md:-right-10 md:flex-col" aria-label={t('正在看这一块的人')}>
      {here.map((viewer) => (
        <img
          key={viewer.login}
          src={avatarUrl(viewer.id, 48)}
          alt={viewer.login}
          title={t('@{login} 正在看这里', { login: viewer.login })}
          className="w-6 h-6 rounded-full ring-2 ring-white bg-gray-200 shadow-sm"
        />
      ))}
    </div>
  );
};

/** A block's comments, for its button, its badge and the highlights in its PDF. */
interface BlockComments {
  count: number;
  /** The block's first open thread, for the badge. */
  first?: string;
  quotes: QuoteMark[];
  active: string | null;
  onAdd: () => void;
  onOpen: (id: string) => void;
}

const BlockItem: React.FC<{ paperId: string; block: ResultBlock; comments?: BlockComments }> = ({ paperId, block, comments }) => {
  const { editing } = useEditMode();
  const t = useT();
  const add = comments && (
    <button
      type="button"
      onClick={comments.onAdd}
      title={t('批注这一块')}
      aria-label={t('批注这一块')}
      className={
        editing
          ? 'inline-flex h-8 items-center gap-1 rounded-full border border-gray-300 bg-white px-2.5 text-xs text-gray-600 shadow-sm hover:border-purple-300 hover:text-purple-700'
          : 'absolute right-1 top-1 z-10 rounded-full border border-gray-200 bg-white/90 p-1.5 text-gray-400 opacity-0 shadow-sm transition-opacity hover:text-purple-700 focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100'
      }
    >
      <MessageSquarePlus size={14} />
      {editing && t('批注')}
    </button>
  );
  return (
    <div
      data-result-block-id={block.id}
      className={`group relative scroll-mt-24${editing ? ' result-block--editable' : ''}${block.hidden ? ' opacity-50' : ''}`}
    >
      <BlockReaders blockId={block.id} />
      {/* Below the width of the comments column, a block shows how many comments it has. */}
      {comments && comments.count > 0 && comments.first && (
        <button
          type="button"
          onClick={() => comments.onOpen(comments.first!)}
          className="absolute -top-8 left-0 z-10 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 xl:hidden"
        >
          <MessageSquare size={12} />
          {comments.count}
        </button>
      )}
      {!editing && add}
      {editing && (
        <div className="flex items-center justify-end gap-2 mb-1 text-xs text-gray-400">
          {t(KIND_LABEL[block.kind])}
          {block.hidden && <HiddenBadge />}
          {add}
          {block.source && <CopyButton text={() => exportTex(block.source ?? '')} label={t('复制 LaTeX')} title={t('复制 LaTeX 代码（开头注明需要的宏包）')} />}
          <EditButton request={{ kind: 'block', paperId, blockId: block.id }} label={t(EDIT_LABEL[block.kind])} />
        </div>
      )}
      <BlockView paperId={paperId} block={block} quotes={comments?.quotes} activeQuote={comments?.active} onQuoteClick={comments?.onOpen} />
      {editing && (
        <div className="result-block-insert" role="group" aria-label={t('在当前块下方插入内容')}>
          <InsertButtons paperId={paperId} afterBlockId={block.id} />
        </div>
      )}
    </div>
  );
};

/** Who can see a paper while it is hidden, and how the site gets edits to it. */
const Notices: React.FC<{ paper: ResultPaper; access: ResultsAccess | null; editing: boolean }> = ({ paper, access, editing }) => {
  const t = useT();
  const collaborator = isCollaborator(access);
  const shared = (paper.viewers?.length ?? 0) + (paper.editors?.length ?? 0) > 0;
  const pending = paper.pendingReview ?? [];
  const note = 'mb-8 p-3 rounded-md text-sm';
  return (
    <>
      {paper.hidden && (
        <div className={`${note} bg-gray-50 text-gray-600`}>
          {collaborator
            ? t('这篇论文目前不公开，只有作者和受邀的协作者能看到。')
            : shared
              ? t('这篇论文目前不公开，只有你和共享名单里的人登录后能看到。在"编辑论文信息"里取消隐藏，才会发布到网站。')
              : t('这篇论文目前不公开，只有你登录后能看到。在"编辑论文信息"里取消隐藏，才会发布到网站。')}
        </div>
      )}
      {collaborator && editing && !paper.hidden && (
        <div className={`${note} bg-gray-50 text-gray-600`}>{t('这篇论文已经公开。你的修改会先保存，作者确认后才会更新到公开的网站上。')}</div>
      )}
      {!paper.hidden && pending.length > 0 && access?.approveEdits && (
        <div role="alert" className={`${note} bg-amber-50 text-amber-800`}>
          {t('{logins} 修改过这篇已公开的论文，网站上仍是修改前的版本。', { logins: pending.map((login) => `@${login}`).join(t('、')) })}
          <button type="button" onClick={() => access.approveEdits?.(paper.id)} className="ml-2 font-medium underline hover:text-amber-900">
            {t('发布这些修改')}
          </button>
        </div>
      )}
    </>
  );
};

/** Where on the page a block is, for the tooltip of someone's avatar. */
function placeOf(blockId: string | undefined, blocks: ResultBlock[], t: Translate): string {
  if (!blockId) return t('开头');
  if (blockId === 'references') return t('参考文献');
  const index = blocks.findIndex((block) => block.id === blockId);
  return index < 0 ? t('这篇论文') : t('第 {n} 块（{kind}）', { n: index + 1, kind: t(KIND_LABEL[blocks[index].kind]) });
}

/** Scrolls to a block of this page, or to the top for none. */
function goTo(blockId: string | undefined): void {
  if (!blockId) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  document.querySelector(`[data-result-block-id="${CSS.escape(blockId)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Who else has this paper open right now, like the avatars in Overleaf; clicking one goes to where they are. */
const Viewers: React.FC<{ blocks: ResultBlock[] }> = ({ blocks }) => {
  const presence = usePresence();
  const t = useT();
  const others = presence?.viewers.filter((viewer) => viewer.login !== presence.me?.login) ?? [];
  if (others.length === 0) return null;
  const shown = others.slice(0, 6);
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500" aria-label={t('正在看这篇论文的人')}>
      <span className="hidden sm:inline">{t('正在看')}</span>
      <div className="flex -space-x-2">
        {shown.map((viewer) => (
          <button
            key={viewer.login}
            type="button"
            onClick={() => goTo(viewer.block)}
            title={t('@{login} 正在看{place}，点击跳过去', { login: viewer.login, place: placeOf(viewer.block, blocks, t) })}
            className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            <img src={avatarUrl(viewer.id)} alt={viewer.login} className="w-7 h-7 rounded-full ring-2 ring-white bg-gray-200" />
          </button>
        ))}
      </div>
      {others.length > shown.length && <span>+{others.length - shown.length}</span>}
    </div>
  );
};

/** Whether the window is wide enough for the comments column (Tailwind's xl). */
function useWide(): boolean {
  const query = '(min-width: 1280px)';
  // Server rendering (the page tests) has no window.
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setWide(list.matches);
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, []);
  return wide;
}

/** One paper's results: its blocks of text, figures and tables, each compiled to a PDF. */
const ResultPage: React.FC = () => {
  const { slug } = useParams();
  const { results } = useContent();
  const t = useT();
  const editMode = useEditMode();
  const { loggedIn, ready, reorderBlocks } = editMode;
  const access = useResultsAccess();
  const collaborator = isCollaborator(access);
  const paper = findPaper(results, slug);
  // The owner edits whenever edit mode is on; a collaborator only the papers they may edit.
  const editing = paper ? (collaborator ? canEditShared(access, paper.id) : editMode.editing) : false;
  const pageMode = useMemo(() => ({ ...editMode, editing }), [editMode, editing]);
  // Tell the presence room which paper this page shows and which block is on screen, so others on it see
  // this reader there; the outline marks the same place.
  const presence = usePresence();
  const setPaper = presence?.setPaper;
  const setBlock = presence?.setBlock;
  const paperId = paper?.id;
  useEffect(() => {
    if (!setPaper || !paperId) return undefined;
    setPaper(paperId);
    return () => setPaper(null);
  }, [setPaper, paperId]);
  // Someone who may edit the paper likely will: get the editor ready once the page itself has had its turn.
  const prepare = editMode.prepare;
  useEffect(() => {
    if (!editing || !prepare || !paperId) return undefined;
    const timer = setTimeout(() => prepare(paperId), 1000);
    return () => clearTimeout(timer);
  }, [editing, prepare, paperId]);
  const [reading, setReading] = useState<string | null>(null);
  const onBlockInView = useCallback(
    (blockId: string | null) => {
      setReading(blockId);
      setBlock?.(blockId);
    },
    [setBlock],
  );
  const readingArea = useRef<HTMLDivElement>(null);
  useReportBlockInView(readingArea, onBlockInView, paperId);
  // Below the width where the outline and the comments sit beside the text, they open as drawers.
  const wide = useWide();
  const [drawer, setDrawer] = useState(false);
  const [commentDrawer, setCommentDrawer] = useState(false);
  useEffect(() => {
    if (!drawer && !commentDrawer) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setDrawer(false);
      setCommentDrawer(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer, commentDrawer]);
  // Comments: the one being written, the one looked at, and whether the column shows (by default when
  // there are open threads).
  const [draft, setDraft] = useState<DraftComment | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [pinned, setPinned] = useState<boolean | null>(null);
  const [contentColumn, setContentColumn] = useState<HTMLDivElement | null>(null);
  const [commentColumn, setCommentColumn] = useState<HTMLElement | null>(null);
  const [selected, clearSelected] = useSelectedQuote(readingArea, Boolean(presence));
  useEffect(() => {
    setDraft(null);
    setFocused(null);
  }, [paperId]);

  if (!paper) {
    // The private list may still be loading; only then is a missing paper really missing.
    if (!ready || access?.state === 'loading') return null;
    // Someone signed out may have been sent a link to a paper shared with them.
    if (!loggedIn) return <LoginPrompt />;
    return <Navigate to="/results" replace />;
  }
  if (paper.hidden && !loggedIn) return <Navigate to="/results" replace />;

  const blocks = shownBlocks(paper.blocks, editing);
  const items = outlineItems(paper.blocks, (block) => editing || !block.hidden, paper.references !== undefined, paper.preamble);
  const order = [...blocks.map((block) => block.id), ...(paper.references ? ['references'] : [])];
  const readers: Record<string, Reader[]> = {};
  for (const viewer of presence?.viewers ?? []) {
    const item = viewer.login === presence?.me?.login ? null : itemAt(items, order, viewer.block);
    if (item) readers[item] = [...(readers[item] ?? []), viewer];
  }
  // A heading inside a block is found in its PDF; anything else, or a heading not drawn yet, is the block's top.
  const go = (item: OutlineItem) => {
    setDrawer(false);
    if (!item.heading || !goToHeading(item.blockId, item.heading.index, item.heading.of)) goTo(item.blockId);
  };
  const allThreads = presence?.comments?.paper === paper.id ? presence.comments.threads : [];
  const openThreads = allThreads.filter((thread) => !thread.resolved);
  const columnShown = Boolean(presence) && (draft !== null || (pinned ?? openThreads.length > 0));
  const startDraft = (next: DraftComment) => {
    setDraft(next);
    setFocused(null);
    // Once someone works with the comments, the column stays until they close it.
    if (wide) setPinned(true);
    else setCommentDrawer(true);
  };
  const post = (text: string) => {
    if (!draft) return;
    presence?.comment({ kind: 'add', block: draft.block, text, ...(draft.quote ? { quote: draft.quote, prefix: draft.prefix, suffix: draft.suffix } : {}) });
    setDraft(null);
  };
  // From a card to what it discusses, and from highlighted text to its card.
  const reveal = (id: string) => {
    setFocused(id);
    const thread = allThreads.find((item) => item.id === id);
    if (!thread) return;
    if (!wide) setCommentDrawer(false);
    const target =
      document.querySelector(`[data-comment-highlight="${CSS.escape(id)}"]`) ?? document.querySelector(`[data-result-block-id="${CSS.escape(thread.block)}"]`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const openThread = (id: string) => {
    setFocused(id);
    if (wide) setPinned(true);
    else setCommentDrawer(true);
    requestAnimationFrame(() => document.getElementById(`comment-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };
  const blockComments = (blockId: string): BlockComments | undefined => {
    if (!presence) return undefined;
    const threads = openThreads.filter((thread) => thread.block === blockId);
    // The text a comment is being written about stays marked while the selection is gone.
    const drafting = draft?.quote && draft.block === blockId ? [{ id: DRAFT, quote: draft.quote, prefix: draft.prefix, suffix: draft.suffix }] : [];
    return {
      count: threads.length,
      first: threads[0]?.id,
      quotes: [...threads.flatMap((thread) => (thread.quote ? [{ id: thread.id, quote: thread.quote, prefix: thread.prefix, suffix: thread.suffix }] : [])), ...drafting],
      active: drafting.length > 0 ? DRAFT : focused,
      onAdd: () => startDraft({ block: blockId }),
      onOpen: (id) => {
        if (id !== DRAFT) openThread(id);
      },
    };
  };
  const panel = (aligned: boolean) => (
    <CommentsPanel
      threads={showResolved ? allThreads : openThreads}
      order={order}
      draft={draft}
      focused={focused}
      resolvedCount={allThreads.length - openThreads.length}
      showResolved={showResolved}
      onToggleResolved={() => setShowResolved((value) => !value)}
      aligned={aligned ? { column: commentColumn, content: contentColumn } : undefined}
      meId={presence?.me?.id}
      owner={!collaborator}
      connected={Boolean(presence?.connected)}
      onFocus={reveal}
      onPost={post}
      onCancelDraft={() => setDraft(null)}
      onClose={() => {
        setDraft(null);
        if (aligned) setPinned(false);
        else setCommentDrawer(false);
      }}
      act={(op) => {
        if (aligned) setPinned(true);
        presence?.comment(op);
      }}
    />
  );
  const referencesComments = blockComments('references');
  const outline =
    items.length > 0 ? (
      <Outline items={items} active={itemAt(items, order, reading)} readers={readers} onGo={go} />
    ) : editing && !collaborator ? (
      <p className="px-2 text-xs text-gray-400">{t('在文字块里用 \\section 等写小节标题后，这里会出现目录。')}</p>
    ) : null;

  return (
    <EditModeContext.Provider value={pageMode}>
      {/* On wide screens the outline and the comments sit beside the text; the site widens a paper's page for them (SiteLayout). */}
      <div
        className={`animate-fade-in pb-20 ${
          outline
            ? columnShown
              ? 'xl:grid xl:grid-cols-[14rem_minmax(0,1fr)_18rem] xl:gap-10'
              : 'xl:grid xl:grid-cols-[14rem_minmax(0,1fr)] xl:gap-10'
            : columnShown
              ? 'xl:grid xl:grid-cols-[minmax(0,1fr)_18rem] xl:gap-10'
              : 'xl:mx-auto xl:max-w-[58rem]'
        }`}
      >
        {outline && (
          <aside className="hidden xl:block">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-6">{outline}</div>
          </aside>
        )}
        <div ref={setContentColumn} className="min-w-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link to="/results" className="text-sm text-gray-500 hover:text-purple-600">
                ← {t('论文结果')}
              </Link>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDrawer(true)}
                  className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-purple-600 xl:hidden"
                >
                  <ListTree size={16} />
                  {t('目录')}
                </button>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Viewers blocks={blocks} />
              {presence && (
                <button
                  type="button"
                  onClick={() => (wide ? setPinned(!columnShown) : setCommentDrawer((open) => !open))}
                  className={`inline-flex items-center gap-1 text-sm ${columnShown && wide ? 'text-purple-700' : 'text-gray-500 hover:text-purple-600'}`}
                >
                  <MessageSquare size={16} />
                  {openThreads.length > 0 ? t('批注 {n}', { n: openThreads.length }) : t('批注')}
                </button>
              )}
            </div>
          </div>
          <div className="mt-4 mb-10">
            <h1 className="text-3xl font-light text-gray-900 mb-3">
              {paper.title}
              {/* The paper's information and who it is shared with stay with the owner. */}
              {!collaborator && (
                <EditButton
                  request={{ kind: 'edit', collection: 'results', id: paper.id }}
                  label={t('编辑论文信息')}
                  className="ml-3 align-middle"
                />
              )}
              {paper.hidden && <HiddenBadge />}
            </h1>
            {paper.authors.length > 0 && (
              <div className="text-gray-700 text-sm mb-1 font-light">
                <Authors authors={paper.authors} />
              </div>
            )}
            {(paper.venue || paper.year) && (
              <div className="text-sm italic text-gray-500 mb-2">{[paper.venue, paper.year].filter(Boolean).join(' · ')}</div>
            )}
            {paper.summary && <p className="text-sm text-gray-600">{paper.summary}</p>}
            <EditButton
              request={{ kind: 'paperSettings', paperId: paper.id }}
              label={t('导言区与附件')}
              text={t('导言区与附件')}
              className="mt-3"
            />
            <EditButton request={{ kind: 'references', paperId: paper.id }} label={t('参考文献')} text={t('参考文献')} className="mt-3 ml-2" />
            {editing && !collaborator && (
              <CopyButton
                pill
                text={() => exportPaperTex(paper.blocks)}
                label={t('导出全文 LaTeX')}
                title={t('按顺序复制所有块（包括隐藏的），开头注明需要的宏包，不含 References')}
                className="mt-3 ml-2"
              />
            )}
          </div>
          <ResultsUnavailable />
          <Notices paper={paper} access={access} editing={editing} />
          <div ref={readingArea}>
            <SortableGroup
              collection="results"
              items={blocks}
              className="space-y-10"
              onReorder={(ids) => reorderBlocks(paper.id, ids)}
              renderItem={(block) => <BlockItem paperId={paper.id} block={block} comments={blockComments(block.id)} />}
            />
            {/* "References": the entries the blocks cite from references.bib, typeset after them. */}
            {paper.references && (
              <div data-result-block-id="references" className="relative mt-10 scroll-mt-24">
                <BlockReaders blockId="references" />
                <BlockView
                  paperId={paper.id}
                  block={{ id: 'references', kind: 'text', output: paper.references }}
                  references
                  quotes={referencesComments?.quotes}
                  activeQuote={referencesComments?.active}
                  onQuoteClick={referencesComments?.onOpen}
                />
              </div>
            )}
          </div>
          {!paper.references && editing && (paper.files ?? []).includes('references.bib') && (
            <p className="mt-10 text-sm italic text-gray-400">{t('References：正文里还没有用 \\cite 引用 references.bib 里的文献。')}</p>
          )}
          {blocks.length === 0 && (
            <div className="text-center text-gray-500 py-12 italic">{editing ? t('用下面的按钮添加文字、图或表格。') : t('这里还没有内容。')}</div>
          )}
          {editing && (
            <div className="mt-10 flex flex-wrap items-center gap-2">
              <InsertButtons paperId={paper.id} />
            </div>
          )}
        </div>
        {wide && columnShown && (
          <aside ref={setCommentColumn} aria-label={t('批注')}>
            {panel(true)}
          </aside>
        )}
      </div>
      {!wide && commentDrawer && presence && (
        <div role="dialog" aria-modal="true" aria-label={t('批注')} className="fixed inset-0 z-[90]">
          <div className="absolute inset-0 bg-black/30" onClick={() => setCommentDrawer(false)} />
          <div className="absolute inset-y-0 right-0 w-80 max-w-[90vw] overflow-y-auto bg-gray-50 p-4 shadow-xl">{panel(false)}</div>
        </div>
      )}
      {/* Text selected in a block's PDF can be commented on. */}
      {selected &&
        createPortal(
          <button
            type="button"
            // Keep the selection while the button is pressed.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              startDraft({ block: selected.block, quote: selected.quote, prefix: selected.prefix, suffix: selected.suffix, y: selected.y });
              clearSelected();
            }}
            style={{ position: 'absolute', left: Math.min(Math.max(selected.x, 48), document.documentElement.clientWidth - 48), top: selected.y + 8 }}
            className="z-[60] inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-gray-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-gray-700"
          >
            <MessageSquarePlus size={14} />
            {t('批注')}
          </button>,
          document.body,
        )}
      {drawer && items.length > 0 && (
        <div role="dialog" aria-modal="true" aria-label={t('目录')} className="fixed inset-0 z-[90] xl:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-white p-4 shadow-xl">
            <div className="mb-1 flex justify-end">
              <button type="button" onClick={() => setDrawer(false)} aria-label={t('关闭目录')} className="p-1 text-gray-400 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>
            {outline}
          </div>
        </div>
      )}
    </EditModeContext.Provider>
  );
};

export default ResultPage;
