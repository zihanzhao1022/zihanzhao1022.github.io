import React, { Suspense, lazy, useCallback, useMemo, useRef, useState } from 'react';
import { Eye, Pencil, Presentation as PresentIcon, Share2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ContentContext } from '../components/ContentContext';
import { EditModeContext, EditModeValue } from '../components/EditMode';
import { PickedFile } from '../components/results/droppedFiles';
import { ResultsAccessContext, canEditShared } from '../components/results/access';
import ResultPage from '../components/results/ResultPage';
import { PresenceContext } from '../components/presence';
import { ItemModal } from '../editor/components/ItemModal';
import { usePresence } from '../editor/presence';
import { loadAttachments } from '../editor/results/actions';
import { UploadPlan, planUpload } from '../editor/results/uploads';
import { describeSaveError } from '../editor/backend';
import { findPaper } from '../lib/results';
import { useT } from '../lib/phrases/app';
import { EditRequest, ResultPaper } from '../types';
import { collaboratorSession, ownerSession } from './accounts';
import { PaperList, useAccount } from './AccountContext';
import { Reach } from './Dashboard';
import Presentation from './Presentation';
import ShareDialog from './ShareDialog';

const BlockEditor = lazy(() => import('../editor/results/BlockEditor'));
const PaperSettings = lazy(() => import('../editor/results/PaperSettings'));
const ReferencesEditor = lazy(() => import('../editor/results/ReferencesEditor'));
const UploadDialog = lazy(() => import('../editor/results/UploadDialog'));

const noop = () => {};

const TOOL =
  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40';

/**
 * A paper opened by its owner or by someone it is shared with: the results page with its editors, sharing and
 * the presentation mode. `list` is where the paper came from: the account's own papers, or the shared ones.
 */
const Workspace: React.FC<{ list: PaperList; owner: boolean; paperId?: string }> = ({ list, owner, paperId }) => {
  const t = useT();
  const account = useAccount()!;
  const { slug } = useParams();
  const { access, saveResults, saveContentOp, reorderBlocks, switchBlock: switchToKept, uploadFiles: uploadToPaper, isRenumbering, content } = list;
  // Shared papers come from several owners, whose slugs may repeat: the route says which one.
  const paper = (paperId ? content.results.find((item) => item.id === paperId) : undefined) ?? findPaper(content.results, slug);
  const shown = useMemo(() => ({ ...content, results: paper ? [paper] : [] }), [content, paper]);
  const session = useMemo(() => (owner ? ownerSession(account.account) : collaboratorSession(account.account)), [owner, account.account]);
  const presence = usePresence(session);
  const [request, setRequest] = useState<EditRequest | null>(null);
  const [upload, setUpload] = useState<{ paperId: string; plan: UploadPlan } | null>(null);
  // The owner looks at the page as readers see it, or edits it.
  const [editing, setEditing] = useState(true);
  const [presenting, setPresenting] = useState(false);
  const [sharingOpen, setSharingOpen] = useState(false);
  const [saving, setSaving] = useState(0);
  const contentRef = useRef(content);
  contentRef.current = content;
  const { setToast } = account;

  // How many saves are on their way, for the toolbar.
  const counted = useCallback<typeof saveResults>(
    (...args) => {
      setSaving((n) => n + 1);
      return saveResults(...args).finally(() => setSaving((n) => n - 1));
    },
    [saveResults],
  );

  const busy = useCallback(
    (paperId: string): boolean => {
      if (access.state !== 'private') {
        setToast({ message: () => t('论文还在加载，请稍后再试') });
        return true;
      }
      if (isRenumbering(paperId)) {
        setToast({ message: () => t('正在更新编号并保存，请几秒后再编辑') });
        return true;
      }
      return false;
    },
    [access.state, isRenumbering, setToast, t],
  );

  const open = useCallback(
    (next: EditRequest) => {
      const paperId = next.kind === 'edit' ? next.id : 'paperId' in next ? next.paperId : null;
      if (!owner && ((next.kind !== 'block' && next.kind !== 'paperSettings') || !canEditShared(access, paperId ?? ''))) {
        setToast({ message: () => t('你只能编辑作者允许你编辑的论文') });
        return;
      }
      if (paperId && busy(paperId)) return;
      setRequest(next);
    },
    [owner, access, busy, setToast, t],
  );

  const prepared = useRef(new Set<string>());
  const prepare = useCallback(
    (paperId: string) => {
      void import('../editor/tex/engine').then(({ warmTexEngine }) => warmTexEngine());
      void import('../editor/results/BlockEditor').catch(() => undefined);
      const item = contentRef.current.results.find((candidate) => candidate.id === paperId);
      if (!item || access.state !== 'private' || prepared.current.has(paperId)) return;
      prepared.current.add(paperId);
      loadAttachments(item, access.readFile).catch(() => prepared.current.delete(paperId));
    },
    [access],
  );

  const switchBlock = useCallback(
    (paperId: string, blockId: string) => {
      if (busy(paperId)) return;
      switchToKept(paperId, blockId, (convertTo) => setRequest({ kind: 'block', paperId, blockId, convertTo }));
    },
    [busy, switchToKept],
  );

  const uploadFiles = useCallback(
    (paperId: string, picked: PickedFile[]) => {
      const item = contentRef.current.results.find((candidate) => candidate.id === paperId);
      if (!item || busy(paperId)) return;
      planUpload(picked, item.files ?? []).then(
        (plan) => setUpload({ paperId, plan }),
        (error: unknown) => setToast({ message: () => describeSaveError(error) }),
      );
    },
    [busy, setToast],
  );

  const value = useMemo<EditModeValue>(
    () => ({
      editing: owner && editing,
      loggedIn: true,
      canLogin: true,
      ready: access.state !== 'loading',
      open,
      login: noop,
      reorder: noop,
      reorderBlocks,
      ...(owner ? { switchBlock, uploadFiles } : {}),
      prepare,
    }),
    [owner, editing, access.state, open, reorderBlocks, switchBlock, uploadFiles, prepare],
  );

  const closeDialog = useCallback(() => setRequest(null), []);
  const target: ResultPaper | undefined =
    request && request.kind !== 'edit' && 'paperId' in request ? content.results.find((item) => item.id === request.paperId) : undefined;
  const canEdit = owner || (paper ? canEditShared(access, paper.id) : false);

  if (access.state === 'loading') return <p className="py-24 text-center text-sm text-gray-400">{t('正在打开论文…')}</p>;
  if (!paper) {
    return (
      <div className="py-24 text-center">
        <p className="text-gray-700">{t('找不到这篇论文，可能已经删除，或者作者取消了共享。')}</p>
        <Link to="/" className="mt-4 inline-block text-sm text-violet-700 hover:underline">
          {t('回到我的论文')}
        </Link>
      </div>
    );
  }

  return (
    <ContentContext.Provider value={shown}>
      <EditModeContext.Provider value={value}>
        <ResultsAccessContext.Provider value={access}>
          <PresenceContext.Provider value={presence}>
            {/* The paper's own bar: what one does with the whole paper. */}
            <div className="sticky top-14 z-30 -mx-4 mb-6 flex flex-wrap items-center gap-1 border-b border-gray-200 bg-white/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 md:-mx-12 md:px-12">
              <span className="mr-auto flex min-w-0 items-center gap-4 text-sm text-gray-500">
                {owner ? <Reach paper={paper} /> : <span className="truncate">{t('{name} 共享给你', { name: account.ownerOf(paper.id)?.name ?? '' })}</span>}
                {saving > 0 && <span className="text-gray-400">{t('保存中…')}</span>}
              </span>
              {owner && (
                <button type="button" onClick={() => setEditing((on) => !on)} aria-pressed={!editing} className={TOOL}>
                  {editing ? <Eye size={16} /> : <Pencil size={16} />}
                  {editing ? t('看读者视角') : t('回到编辑')}
                </button>
              )}
              <button type="button" onClick={() => setPresenting(true)} className={TOOL}>
                <PresentIcon size={16} />
                {t('演示')}
              </button>
              {owner && (
                <button type="button" onClick={() => setSharingOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-800">
                  <Share2 size={16} />
                  {t('分享')}
                </button>
              )}
              {!owner && !canEdit && <span className="text-sm text-gray-400">{t('只读')}</span>}
            </div>
            <ResultPage inApp backTo="/" backLabel={t('我的论文')} />
            {request?.kind === 'block' && target && (
              <Suspense fallback={null}>
                <BlockEditor
                  paper={target}
                  blockId={request.blockId}
                  blockKind={request.blockKind}
                  afterBlockId={request.afterBlockId}
                  convertTo={request.convertTo}
                  readFile={access.readFile}
                  onSave={counted}
                  onClose={closeDialog}
                />
              </Suspense>
            )}
            {request?.kind === 'paperSettings' && target && (
              <Suspense fallback={null}>
                <PaperSettings paper={target} readFile={access.readFile} onSave={counted} onClose={closeDialog} />
              </Suspense>
            )}
            {request?.kind === 'references' && target && owner && (
              <Suspense fallback={null}>
                <ReferencesEditor paper={target} readFile={access.readFile} onSave={counted} onClose={closeDialog} />
              </Suspense>
            )}
            {request?.kind === 'edit' && owner && (
              <ItemModal request={request} content={content} onSave={(op) => saveContentOp(op)} onClose={closeDialog} />
            )}
            {upload && (
              <Suspense fallback={null}>
                <UploadDialog
                  title={paper.title}
                  plan={upload.plan}
                  onConfirm={() => {
                    uploadToPaper(upload.paperId, upload.plan.files);
                    setUpload(null);
                  }}
                  onClose={() => setUpload(null)}
                />
              </Suspense>
            )}
            {sharingOpen && owner && (
              <ShareDialog paper={paper} owner={account.account} saveContentOp={saveContentOp} saveResults={counted} onClose={() => setSharingOpen(false)} />
            )}
            {presenting && <Presentation paper={paper} readFile={access.readFile} onClose={() => setPresenting(false)} />}
          </PresenceContext.Provider>
        </ResultsAccessContext.Provider>
      </EditModeContext.Provider>
    </ContentContext.Provider>
  );
};

export default Workspace;
