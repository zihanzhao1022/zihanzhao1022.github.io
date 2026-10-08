import React, { Suspense, lazy, useCallback, useMemo, useRef, useState } from 'react';
import { Loader2, LogOut } from 'lucide-react';
import { useContent, useUpdateContent } from '../components/ContentContext';
import { EditModeContext, EditModeValue, Toast } from '../components/EditMode';
import { ResultsAccessContext, canEditShared } from '../components/results/access';
import { Session, clearSession, isExpiringSoon } from '../lib/session';
import { EditRequest } from '../types';
import { logout, startLogin } from './auth';
import { EditorToast, useResultsEditor } from './results/useResults';

// The LaTeX editors (CodeMirror, the TeX engine) load only when a dialog opens.
const BlockEditor = lazy(() => import('./results/BlockEditor'));
const PaperSettings = lazy(() => import('./results/PaperSettings'));

const EXPIRING = '登录即将过期，请重新登录后再编辑';
const noop = (): void => {};

interface Props {
  session: Session;
  onLogout: (message?: string) => void;
  children: React.ReactNode;
}

const CollaboratorBar: React.FC<{ session: Session; loading: boolean; onLogout: () => void }> = ({ session, loading, onLogout }) => (
  <div className="bg-gray-900 text-xs text-gray-300">
    <div className="max-w-5xl mx-auto px-6 md:px-12 py-2 flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="flex items-center gap-2">
        {session.avatarUrl ? (
          <img src={session.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
        ) : (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-600 text-[10px] font-semibold text-white">
            {session.login.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="font-medium text-white">{session.login}</span>
        <span className="text-gray-400">协作者</span>
      </span>
      {/* The bar sits outside the router (like the owner's), so this is a plain link to the hash route. */}
      <a href="#/results" className="text-purple-300 hover:text-purple-200">
        共享给你的论文 →
      </a>
      {loading && (
        <span className="ml-auto flex items-center gap-1 text-gray-400">
          <Loader2 size={12} className="animate-spin" />
          正在读取…
        </span>
      )}
      <button type="button" onClick={onLogout} className={`${loading ? '' : 'ml-auto '}flex items-center gap-1 text-gray-400 hover:text-white`}>
        <LogOut size={12} />
        退出
      </button>
    </div>
  </div>
);

/**
 * The site for someone the owner shared results papers with: everything stays read-only except the papers
 * they may edit, whose blocks, preamble and attachments they edit like the owner (through the worker).
 */
const CollaboratorRoot: React.FC<Props> = ({ session, onLogout, children }) => {
  const content = useContent();
  const setContent = useUpdateContent();
  const contentRef = useRef(content);
  contentRef.current = content;
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [request, setRequest] = useState<EditRequest | null>(null);
  const [toast, setToast] = useState<(EditorToast & { relogin?: boolean }) | null>(null);
  const logoutRef = useRef(onLogout);
  logoutRef.current = onLogout;

  const signOut = useCallback((message: string) => {
    clearSession();
    logoutRef.current(message);
  }, []);

  const { access, saveResults, reorderBlocks, isReordering } = useResultsEditor({
    session,
    setContent,
    contentRef,
    queue,
    onDeploy: noop,
    onToast: setToast,
    onSignedOut: signOut,
  });

  const relogin = useCallback(() => {
    void startLogin();
  }, []);

  const open = useCallback(
    (next: EditRequest) => {
      if (isExpiringSoon(session)) {
        setToast({ message: EXPIRING, relogin: true });
        return;
      }
      if ((next.kind !== 'block' && next.kind !== 'paperSettings') || !canEditShared(access, next.paperId)) {
        setToast({ message: '你只能编辑作者允许你编辑的论文' });
        return;
      }
      if (access.state !== 'private') {
        setToast({ message: access.state === 'loading' ? '论文还在加载，请稍后再试' : '暂时读不到共享的论文，请刷新页面重试' });
        return;
      }
      if (isReordering(next.paperId)) {
        setToast({ message: '正在保存新的顺序并更新编号，请几秒后再编辑' });
        return;
      }
      setRequest(next);
    },
    [session, access, isReordering],
  );

  const value = useMemo<EditModeValue>(
    () => ({
      // The site stays read-only; a results page turns editing on for a paper they may edit.
      editing: false,
      loggedIn: true,
      canLogin: true,
      ready: access.state !== 'loading',
      open,
      login: relogin,
      reorder: noop,
      reorderBlocks,
    }),
    [access.state, open, relogin, reorderBlocks],
  );

  const handleLogout = useCallback(() => {
    void logout(session).finally(() => logoutRef.current());
  }, [session]);

  const closeDialog = useCallback(() => setRequest(null), []);

  const paper =
    request?.kind === 'block' || request?.kind === 'paperSettings'
      ? content.results.find((item) => item.id === request.paperId)
      : undefined;

  return (
    <EditModeContext.Provider value={value}>
      <ResultsAccessContext.Provider value={access}>
        <CollaboratorBar session={session} loading={access.state === 'loading'} onLogout={handleLogout} />
        {children}
        {request?.kind === 'block' && paper && (
          <Suspense fallback={null}>
            <BlockEditor
              paper={paper}
              blockId={request.blockId}
              blockKind={request.blockKind}
              readFile={access.readFile}
              onSave={saveResults}
              onClose={closeDialog}
            />
          </Suspense>
        )}
        {request?.kind === 'paperSettings' && paper && (
          <Suspense fallback={null}>
            <PaperSettings paper={paper} readFile={access.readFile} onSave={saveResults} onClose={closeDialog} />
          </Suspense>
        )}
        {toast && (
          <Toast
            message={toast.message}
            onClose={() => setToast(null)}
            action={toast.relogin ? { label: '重新登录', onClick: relogin } : toast.action}
          />
        )}
      </ResultsAccessContext.Provider>
    </EditModeContext.Provider>
  );
};

export default CollaboratorRoot;
