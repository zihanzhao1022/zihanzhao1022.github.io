import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { exportTex } from '../../editor/results/texNames';
import { findPaper, shownBlocks } from '../../lib/results';
import { ResultBlock, ResultPaper } from '../../types';
import { useContent } from '../ContentContext';
import { AddButton, EditButton, EditModeContext, HiddenBadge, useEditMode } from '../EditMode';
import { SortableGroup } from '../SortableGroup';
import { ResultsAccess, canEditShared, isCollaborator, useResultsAccess } from './access';
import Authors from './Authors';
import BlockView from './BlockView';
import LoginPrompt from './LoginPrompt';
import { ResultsUnavailable } from './ResultsList';
import './resultPage.css';
import { avatarUrl, usePresence } from '../presence';
import { useReportBlockInView } from './readingPosition';

const KIND_LABEL = { text: '文字', figure: '图', table: '表格' } as const;

const InsertButtons: React.FC<{ paperId: string; afterBlockId?: string }> = ({ paperId, afterBlockId }) => (
  <>
    <AddButton request={{ kind: 'block', paperId, blockKind: 'text', afterBlockId }} text="文字" />
    <AddButton request={{ kind: 'block', paperId, blockKind: 'figure', afterBlockId }} text="图" />
    <AddButton request={{ kind: 'block', paperId, blockKind: 'table', afterBlockId }} text="表格" />
  </>
);

/** Copies the block's LaTeX, headed by the packages it needs, without opening the editor. */
const CopyLatex: React.FC<{ source: string }> = ({ source }) => {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    if (state === 'idle') return undefined;
    const timer = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [state]);
  const copy = () => {
    navigator.clipboard.writeText(exportTex(source)).then(
      () => setState('copied'),
      () => setState('failed'),
    );
  };
  const label = { idle: '复制 LaTeX', copied: '已复制', failed: '复制失败' }[state];
  return (
    <button
      type="button"
      onClick={copy}
      title="复制 LaTeX 代码（开头注明需要的宏包）"
      className="inline-flex items-center gap-1 h-8 px-2.5 rounded-full border border-gray-300 bg-white text-xs text-gray-600 shadow-sm hover:border-purple-300 hover:text-purple-700"
    >
      {state === 'copied' ? <Check size={14} /> : <Copy size={14} />}
      {label}
    </button>
  );
};

/** The others looking at a block, beside it like collaborators' cursors in Overleaf. */
const BlockReaders: React.FC<{ blockId: string }> = ({ blockId }) => {
  const presence = usePresence();
  const here = presence?.viewers.filter((viewer) => viewer.block === blockId && viewer.login !== presence.me?.login) ?? [];
  if (here.length === 0) return null;
  return (
    // In the right margin: the left one holds the drag handles while editing.
    <div className="absolute z-10 -top-8 right-0 flex gap-1 md:top-0 md:-right-10 md:flex-col" aria-label="正在看这一块的人">
      {here.map((viewer) => (
        <img
          key={viewer.login}
          src={avatarUrl(viewer.id, 48)}
          alt={viewer.login}
          title={`@${viewer.login} 正在看这里`}
          className="w-6 h-6 rounded-full ring-2 ring-white bg-gray-200 shadow-sm"
        />
      ))}
    </div>
  );
};

const BlockItem: React.FC<{ paperId: string; block: ResultBlock }> = ({ paperId, block }) => {
  const { editing } = useEditMode();
  return (
    <div
      data-result-block-id={block.id}
      className={`relative scroll-mt-24${editing ? ' result-block--editable' : ''}${block.hidden ? ' opacity-50' : ''}`}
    >
      <BlockReaders blockId={block.id} />
      {editing && (
        <div className="flex items-center justify-end gap-2 mb-1 text-xs text-gray-400">
          {KIND_LABEL[block.kind]}
          {block.hidden && <HiddenBadge />}
          {block.source && <CopyLatex source={block.source} />}
          <EditButton request={{ kind: 'block', paperId, blockId: block.id }} label={`编辑${KIND_LABEL[block.kind]}`} />
        </div>
      )}
      <BlockView paperId={paperId} block={block} />
      {editing && (
        <div className="result-block-insert" role="group" aria-label="在当前块下方插入内容">
          <InsertButtons paperId={paperId} afterBlockId={block.id} />
        </div>
      )}
    </div>
  );
};

/** Who can see a paper while it is hidden, and how the site gets edits to it. */
const Notices: React.FC<{ paper: ResultPaper; access: ResultsAccess | null; editing: boolean }> = ({ paper, access, editing }) => {
  const collaborator = isCollaborator(access);
  const shared = (paper.viewers?.length ?? 0) + (paper.editors?.length ?? 0) > 0;
  const pending = paper.pendingReview ?? [];
  const note = 'mb-8 p-3 rounded-md text-sm';
  return (
    <>
      {paper.hidden && (
        <div className={`${note} bg-gray-50 text-gray-600`}>
          {collaborator
            ? '这篇论文目前不公开，只有作者和受邀的协作者能看到。'
            : `这篇论文目前不公开，只有你${shared ? '和共享名单里的人' : ''}登录后能看到。在"编辑论文信息"里取消隐藏，才会发布到网站。`}
        </div>
      )}
      {collaborator && editing && !paper.hidden && (
        <div className={`${note} bg-gray-50 text-gray-600`}>这篇论文已经公开。你的修改会先保存，作者确认后才会更新到公开的网站上。</div>
      )}
      {!paper.hidden && pending.length > 0 && access?.approveEdits && (
        <div role="alert" className={`${note} bg-amber-50 text-amber-800`}>
          {pending.map((login) => `@${login}`).join('、')} 修改过这篇已公开的论文，网站上仍是修改前的版本。
          <button type="button" onClick={() => access.approveEdits?.(paper.id)} className="ml-2 font-medium underline hover:text-amber-900">
            发布这些修改
          </button>
        </div>
      )}
    </>
  );
};

/** Where on the page a block is, for the tooltip of someone's avatar. */
function placeOf(blockId: string | undefined, blocks: ResultBlock[]): string {
  if (!blockId) return '开头';
  if (blockId === 'references') return '参考文献';
  const index = blocks.findIndex((block) => block.id === blockId);
  return index < 0 ? '这篇论文' : `第 ${index + 1} 块（${KIND_LABEL[blocks[index].kind]}）`;
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
  const others = presence?.viewers.filter((viewer) => viewer.login !== presence.me?.login) ?? [];
  if (others.length === 0) return null;
  const shown = others.slice(0, 6);
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500" aria-label="正在看这篇论文的人">
      <span className="hidden sm:inline">正在看</span>
      <div className="flex -space-x-2">
        {shown.map((viewer) => (
          <button
            key={viewer.login}
            type="button"
            onClick={() => goTo(viewer.block)}
            title={`@${viewer.login} 正在看${placeOf(viewer.block, blocks)}，点击跳过去`}
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

/** One paper's results: its blocks of text, figures and tables, each compiled to a PDF. */
const ResultPage: React.FC = () => {
  const { slug } = useParams();
  const { results } = useContent();
  const editMode = useEditMode();
  const { loggedIn, ready, reorderBlocks } = editMode;
  const access = useResultsAccess();
  const collaborator = isCollaborator(access);
  const paper = findPaper(results, slug);
  // The owner edits whenever edit mode is on; a collaborator only the papers they may edit.
  const editing = paper ? (collaborator ? canEditShared(access, paper.id) : editMode.editing) : false;
  const pageMode = useMemo(() => ({ ...editMode, editing }), [editMode, editing]);
  // Tell the presence room which paper this page shows and which block is on screen, so others on it see
  // this reader there.
  const presence = usePresence();
  const setPaper = presence?.setPaper;
  const paperId = paper?.id;
  useEffect(() => {
    if (!setPaper || !paperId) return undefined;
    setPaper(paperId);
    return () => setPaper(null);
  }, [setPaper, paperId]);
  const readingArea = useRef<HTMLDivElement>(null);
  useReportBlockInView(readingArea, presence?.setBlock, paperId);

  if (!paper) {
    // The private list may still be loading; only then is a missing paper really missing.
    if (!ready || access?.state === 'loading') return null;
    // Someone signed out may have been sent a link to a paper shared with them.
    if (!loggedIn) return <LoginPrompt />;
    return <Navigate to="/results" replace />;
  }
  if (paper.hidden && !loggedIn) return <Navigate to="/results" replace />;

  const blocks = shownBlocks(paper.blocks, editing);

  return (
    <EditModeContext.Provider value={pageMode}>
      <div className="animate-fade-in pb-20">
        <div className="flex items-center justify-between gap-4">
          <Link to="/results" className="text-sm text-gray-500 hover:text-purple-600">
            ← results
          </Link>
          <Viewers blocks={blocks} />
        </div>
        <div className="mt-4 mb-10">
          <h1 className="text-3xl font-light text-gray-900 mb-3">
            {paper.title}
            {/* The paper's information and who it is shared with stay with the owner. */}
            {!collaborator && (
              <EditButton
                request={{ kind: 'edit', collection: 'results', id: paper.id }}
                label="编辑论文信息"
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
            label="导言区与附件"
            text="导言区与附件"
            className="mt-3"
          />
          <EditButton request={{ kind: 'references', paperId: paper.id }} label="参考文献" text="参考文献" className="mt-3 ml-2" />
        </div>
        <ResultsUnavailable />
        <Notices paper={paper} access={access} editing={editing} />
        <div ref={readingArea}>
          <SortableGroup
            collection="results"
            items={blocks}
            className="space-y-10"
            onReorder={(ids) => reorderBlocks(paper.id, ids)}
            renderItem={(block) => <BlockItem paperId={paper.id} block={block} />}
          />
          {/* "References": the entries the blocks cite from references.bib, typeset after them. */}
          {paper.references && (
            <div data-result-block-id="references" className="relative mt-10 scroll-mt-24">
              <BlockReaders blockId="references" />
              <BlockView paperId={paper.id} block={{ id: 'references', kind: 'text', output: paper.references }} references />
            </div>
          )}
        </div>
        {!paper.references && editing && (paper.files ?? []).includes('references.bib') && (
          <p className="mt-10 text-sm italic text-gray-400">References：正文里还没有用 \cite 引用 references.bib 里的文献。</p>
        )}
        {blocks.length === 0 && (
          <div className="text-center text-gray-500 py-12 italic">{editing ? '用下面的按钮添加文字、图或表格。' : 'Nothing here yet.'}</div>
        )}
        {editing && (
          <div className="mt-10 flex flex-wrap items-center gap-2">
            <InsertButtons paperId={paper.id} />
          </div>
        )}
      </div>
    </EditModeContext.Provider>
  );
};

export default ResultPage;
