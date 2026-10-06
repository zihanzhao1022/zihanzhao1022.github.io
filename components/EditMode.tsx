import React, { Suspense, createContext, lazy, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, Pencil, Plus, X } from 'lucide-react';
import { loginConfigured } from '../editor/config';
import { LoginCallback, MOCK_MODE, Session, loadSession } from '../lib/session';
import { EditRequest } from '../types';

export interface EditModeValue {
  /** True when the owner is signed in, the latest content has loaded and the edit switch is on. */
  editing: boolean;
  loggedIn: boolean;
  /** Whether to offer the login entry at all. */
  canLogin: boolean;
  open: (request: EditRequest) => void;
  login: () => void;
}

const noop = (): void => {};

export const EditModeContext = createContext<EditModeValue>({
  editing: false,
  loggedIn: false,
  canLogin: false,
  open: noop,
  login: noop,
});

export const useEditMode = (): EditModeValue => useContext(EditModeContext);

// Loaded only once the owner signs in, so visitors never download the editor.
const EditorRoot = lazy(() => import('../editor/EditorRoot'));

export const Toast: React.FC<{
  message: string;
  onClose: () => void;
  action?: { label: string; onClick: () => void };
}> = ({ message, onClose, action }) => {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const timer = setTimeout(() => close.current(), 6000);
    return () => clearTimeout(timer);
  }, [message]);
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-3 w-max max-w-[90vw] px-4 py-3 rounded-lg bg-gray-900 text-sm text-white shadow-lg"
    >
      <span>{message}</span>
      {action && (
        <button type="button" onClick={action.onClick} className="shrink-0 font-medium text-purple-300 hover:text-purple-200">
          {action.label}
        </button>
      )}
      <button type="button" onClick={onClose} aria-label="关闭" className="shrink-0 text-gray-400 hover:text-white">
        <X size={14} />
      </button>
    </div>
  );
};

export const EditModeProvider: React.FC<{ loginCallback: LoginCallback | null; children: React.ReactNode }> = ({
  loginCallback,
  children,
}) => {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [toast, setToast] = useState<string | null>(null);
  const handledCallback = useRef(false);

  useEffect(() => {
    // The code is single-use, so StrictMode's second effect run must not exchange it again.
    if (!loginCallback || handledCallback.current) return;
    handledCallback.current = true;
    import('../editor/auth')
      .then(({ completeLogin }) => completeLogin(loginCallback))
      .then(setSession)
      .catch((error: unknown) => setToast(error instanceof Error ? error.message : '登录失败，请重新登录'));
  }, [loginCallback]);

  const login = useCallback(() => {
    import('../editor/auth')
      .then(({ startLogin }) => startLogin())
      .then((started) => {
        if (started) setSession(started);
      })
      .catch(() => setToast('无法开始登录，请稍后重试'));
  }, []);

  const handleLogout = useCallback((message?: string) => {
    setSession(null);
    if (message) setToast(message);
  }, []);

  const visitor = useMemo<EditModeValue>(
    () => ({ editing: false, loggedIn: false, canLogin: MOCK_MODE || loginConfigured(), open: noop, login }),
    [login],
  );
  const page = <EditModeContext.Provider value={visitor}>{children}</EditModeContext.Provider>;
  // While the editor loads for a signed-in owner, show the page without the login lock.
  const loading = <EditModeContext.Provider value={{ ...visitor, loggedIn: true }}>{children}</EditModeContext.Provider>;

  return (
    <>
      {session ? (
        <Suspense fallback={loading}>
          <EditorRoot session={session} onLogout={handleLogout}>
            {children}
          </EditorRoot>
        </Suspense>
      ) : (
        page
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </>
  );
};

const PILL =
  'inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-purple-200 bg-white text-xs font-medium normal-case tracking-normal text-purple-700 hover:bg-purple-50 align-middle';
const ROUND =
  'inline-flex items-center justify-center w-8 h-8 rounded-full border border-gray-300 bg-white text-gray-600 shadow-sm hover:border-purple-300 hover:text-purple-700';

/** A pencil that opens an edit dialog; renders nothing outside edit mode. With `text` it becomes a labelled pill. */
export const EditButton: React.FC<{ request: EditRequest; label: string; text?: string; className?: string }> = ({
  request,
  label,
  text,
  className = '',
}) => {
  const { editing, open } = useEditMode();
  if (!editing) return null;
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => open(request)}
      className={`${text ? PILL : ROUND} ${className}`}
    >
      <Pencil size={14} />
      {text}
    </button>
  );
};

export const AddButton: React.FC<{ request: EditRequest; text: string; className?: string }> = ({
  request,
  text,
  className = '',
}) => {
  const { editing, open } = useEditMode();
  if (!editing) return null;
  return (
    <button type="button" onClick={() => open(request)} className={`${PILL} ${className}`}>
      <Plus size={14} />
      {text}
    </button>
  );
};

export const ReorderButton: React.FC<{ request: EditRequest; className?: string }> = ({ request, className = '' }) => {
  const { editing, open } = useEditMode();
  if (!editing) return null;
  return (
    <button type="button" onClick={() => open(request)} className={`${PILL} ${className}`}>
      <ArrowUpDown size={14} />
      排序
    </button>
  );
};
