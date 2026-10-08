import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useContent, useUpdateContent } from '../components/ContentContext';
import { EditModeContext, EditModeValue, Toast } from '../components/EditMode';
import { ResultsAccessContext } from '../components/results/access';
import { registerLocalImage } from '../lib/localImages';
import { Session, clearSession, isExpiringSoon } from '../lib/session';
import { EditRequest, ListCollection } from '../types';
import { logout, startLogin } from './auth';
import { DeployStatus, EditorBackend, ImageUpload, createBackend, describeSaveError } from './backend';
import { GitHubError } from './github';
import { publicUrl } from './images';
import { ContentOp, applyOp, commitMessage } from './ops';
import { AdminBar, LoadState } from './components/AdminBar';
import { ItemModal } from './components/ItemModal';
import { NavigationModal } from './components/NavigationModal';
import { EditorToast, useResultsEditor } from './results/useResults';

// The LaTeX editors (CodeMirror, the TeX engine) load only when a results dialog opens.
const BlockEditor = lazy(() => import('./results/BlockEditor'));
const PaperSettings = lazy(() => import('./results/PaperSettings'));

const FIRST_POLL_MS = 5_000;
const POLL_MS = 10_000;
const POLL_LIMIT_MS = 10 * 60_000;
const EXPIRING = '登录即将过期，请重新登录后再编辑';

interface Props {
  session: Session;
  onLogout: (message?: string) => void;
  children: React.ReactNode;
}

const EditorRoot: React.FC<Props> = ({ session, onLogout, children }) => {
  const content = useContent();
  const setContent = useUpdateContent();
  const [backend, setBackend] = useState<EditorBackend | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [enabled, setEnabled] = useState(true);
  const [request, setRequest] = useState<EditRequest | null>(null);
  const [deploy, setDeploy] = useState<{ sha: string; status: DeployStatus } | null>(null);
  const [toast, setToast] = useState<(EditorToast & { relogin?: boolean }) | null>(null);
  const logoutRef = useRef(onLogout);
  logoutRef.current = onLogout;
  const contentRef = useRef(content);
  contentRef.current = content;
  // Saves run one at a time. `pending` holds ops already shown on the page but not committed yet.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef<ContentOp[]>([]);
  const { access, privateLoaded, saveResults, saveContentOp, reorderBlocks, reload } = useResultsEditor({
    session,
    setContent,
    contentRef,
    queue,
    onDeploy: (sha) => setDeploy({ sha, status: { state: 'pending' } }),
    onToast: setToast,
  });

  // Swap the bundled content for the latest version on GitHub: the last deployment may still be running.
  useEffect(() => {
    let cancelled = false;
    createBackend(session)
      .then(async (created) => {
        const fresh = await created.load();
        if (cancelled) return;
        // The private results list may have arrived first; the public snapshot must not replace it.
        setContent((current) => (privateLoaded.current ? { ...fresh, results: current.results } : fresh));
        setBackend(created);
        setLoadState('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof GitHubError && error.status === 401) {
          clearSession();
          logoutRef.current('登录已失效，请重新登录');
          return;
        }
        setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [session, setContent, privateLoaded]);

  // Follow the deployment of the latest save until it finishes.
  useEffect(() => {
    if (!backend || !deploy || deploy.status.state !== 'pending') return;
    const { sha } = deploy;
    const startedAt = Date.now();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const status = await backend.deployStatus(sha);
        if (stopped) return;
        if (status.state !== 'pending') {
          setDeploy({ sha, status });
          return;
        }
      } catch {
        // Try again on the next tick.
      }
      if (stopped) return;
      if (Date.now() - startedAt > POLL_LIMIT_MS) {
        setDeploy({ sha, status: { state: 'unknown' } });
        return;
      }
      timer = setTimeout(() => void poll(), POLL_MS);
    };
    timer = setTimeout(() => void poll(), FIRST_POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [backend, deploy]);

  const relogin = useCallback(() => {
    void startLogin();
  }, []);

  const open = useCallback(
    (next: EditRequest) => {
      if (isExpiringSoon(session)) {
        setToast({ message: EXPIRING, relogin: true });
        return;
      }
      if ((next.kind === 'block' || next.kind === 'paperSettings') && access.state !== 'private') {
        setToast({ message: access.state === 'loading' ? '论文结果还在加载，请稍后再试' : '私有仓库不可用，暂时不能编辑论文结果' });
        return;
      }
      setRequest(next);
    },
    [session, access.state],
  );

  const save = useCallback(
    (op: ContentOp, uploads: ImageUpload[], message: string): Promise<void> => {
      // Papers of the results pages live in the private repository.
      if (op.collection === 'results') return saveContentOp(op);
      if (!backend) return Promise.reject(new Error('编辑器还在加载，请稍后再试'));
      pending.current.push(op);
      const run = queue.current.then(async () => {
        try {
          const result = await backend.save(op, uploads, message, contentRef.current);
          uploads.forEach((upload) => registerLocalImage(publicUrl(upload.path), upload.previewUrl));
          pending.current = pending.current.filter((queued) => queued !== op);
          // Every op is idempotent, so re-applying the still-queued ones keeps the page as the owner left it.
          setContent(pending.current.reduce((current, queued) => applyOp(current, queued), result.content));
          setDeploy({ sha: result.commitSha, status: { state: 'pending' } });
        } catch (error) {
          pending.current = pending.current.filter((queued) => queued !== op);
          throw error;
        }
      });
      queue.current = run.catch(() => undefined);
      return run;
    },
    [backend, setContent, saveContentOp],
  );

  const reorder = useCallback(
    (collection: ListCollection, ids: string[]) => {
      if (isExpiringSoon(session)) {
        setToast({ message: EXPIRING, relogin: true });
        return;
      }
      const op: ContentOp = { kind: 'reorder', collection, ids };
      setContent((current) => applyOp(current, op));
      save(op, [], commitMessage('reorder', collection)).catch((error: unknown) => {
        setToast({ message: describeSaveError(error) });
        // Put the page back in step with GitHub.
        if (collection === 'results') {
          reload();
          return;
        }
        backend
          ?.load()
          .then((fresh) => setContent((current) => (privateLoaded.current ? { ...fresh, results: current.results } : fresh)))
          .catch(() => undefined);
      });
    },
    [session, setContent, save, backend, reload, privateLoaded],
  );

  const handleLogout = useCallback(() => {
    void logout(session).finally(() => logoutRef.current());
  }, [session]);

  const closeDialog = useCallback(() => setRequest(null), []);

  const value = useMemo<EditModeValue>(
    () => ({
      editing: enabled && loadState === 'ready',
      loggedIn: true,
      canLogin: true,
      ready: loadState !== 'loading',
      open,
      login: relogin,
      reorder,
      reorderBlocks,
    }),
    [enabled, loadState, open, relogin, reorder, reorderBlocks],
  );

  const paper =
    request?.kind === 'block' || request?.kind === 'paperSettings'
      ? content.results.find((item) => item.id === request.paperId)
      : undefined;

  return (
    <EditModeContext.Provider value={value}>
      <ResultsAccessContext.Provider value={access}>
        <AdminBar
          session={session}
          enabled={enabled}
          onToggle={setEnabled}
          loadState={loadState}
          deploy={deploy?.status ?? null}
          onLogout={handleLogout}
        />
        {children}
        {request?.kind === 'navigation' && (
          <NavigationModal
            content={content}
            onSave={save}
            onReorder={(ids) => reorder('navigation', ids)}
            onClose={closeDialog}
          />
        )}
        {(request?.kind === 'edit' || request?.kind === 'add' || request?.kind === 'profile') && (
          <ItemModal request={request} content={content} onSave={save} onClose={closeDialog} />
        )}
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

export default EditorRoot;
