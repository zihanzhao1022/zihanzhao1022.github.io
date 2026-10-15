import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { bundledContent } from '../content';
import { EditorToast, useResultsEditor } from '../editor/results/useResults';
import { createMockCollaboratorBackend, createMockResultsBackend, mockStore } from '../editor/results/mockBackend';
import { ResultsBackend } from '../editor/results/backend';
import { WorkerError } from '../editor/results/workerBackend';
import { SiteContent } from '../types';
import { ACCOUNTS, Account, collaboratorSession, ownerSession, storeKeyOf } from './accounts';
import { Organizer, paperKey, tidy, touch } from './organizer';
import { examplesReady, loadOrganizer, saveOrganizer } from './seed';

/** One of the account's two lists of papers, with what saves to it. */
export type PaperList = ReturnType<typeof useResultsEditor> & { content: SiteContent };

export interface AccountValue {
  account: Account;
  /** The account's own papers, in its repository. */
  mine: PaperList;
  /** Others' papers shared with the account, through the (mock) worker. */
  shared: PaperList;
  /** Whose repository a shared paper is in. */
  ownerOf: (paperId: string) => Account | undefined;
  /** The account's folders, tags and archive, over its own and shared papers. */
  organizer: Organizer;
  organize: (change: (organizer: Organizer) => Organizer) => void;
  /** Notes that the account just changed a paper, for "last modified". */
  touchPaper: (owner: string, paperId: string) => void;
  toast: EditorToast | null;
  setToast: (toast: EditorToast | null) => void;
}

const AccountContext = createContext<AccountValue | null>(null);

export const useAccount = (): AccountValue | null => useContext(AccountContext);

const noop = () => {};
const empty = (): SiteContent => ({ ...bundledContent, results: [] });

/** Others' papers shared with the account; an account nobody shared anything with simply has none. */
function sharedBackend(account: Account): ResultsBackend {
  const keys = ACCOUNTS.filter((other) => other.login !== account.login).map((other) => storeKeyOf(other.login));
  const inner = createMockCollaboratorBackend({ login: account.login, id: account.id }, keys);
  return {
    ...inner,
    async load() {
      try {
        return await inner.load();
      } catch (error) {
        if (error instanceof WorkerError && error.status === 403) return { state: 'ready', papers: [], roles: {} };
        throw error;
      }
    },
  };
}

function useList(session: ReturnType<typeof ownerSession>, connect: () => ResultsBackend, onToast: (toast: EditorToast | null) => void): PaperList {
  const [content, setContent] = useState(empty);
  const contentRef = useRef(content);
  contentRef.current = content;
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const editor = useResultsEditor({
    session,
    setContent,
    contentRef,
    queue,
    onDeploy: noop,
    onToast,
    onSignedOut: noop,
    // The example papers are in the repositories before anything is read.
    connect: () => examplesReady().then(connect),
  });
  return { ...editor, content };
}

/** The signed-in account's papers: its own and those shared with it. */
export const AccountProvider: React.FC<{ account: Account; children: React.ReactNode }> = ({ account, children }) => {
  const [toast, setToast] = useState<EditorToast | null>(null);
  const [organizer, setOrganizer] = useState(() => loadOrganizer(account.login));
  useEffect(() => {
    let current = true;
    void examplesReady().then(() => {
      if (current) setOrganizer(loadOrganizer(account.login));
    });
    return () => {
      current = false;
    };
  }, [account.login]);
  const organize = useCallback(
    (change: (organizer: Organizer) => Organizer) =>
      setOrganizer((current) => {
        const next = tidy(change(current));
        saveOrganizer(account.login, next);
        return next;
      }),
    [account.login],
  );
  const touchPaper = useCallback((owner: string, paperId: string) => organize((current) => touch(current, paperKey(owner, paperId))), [organize]);
  const owner = useMemo(() => ownerSession(account), [account]);
  const collaborator = useMemo(() => collaboratorSession(account), [account]);
  const mine = useList(owner, () => createMockResultsBackend(storeKeyOf(account.login)), setToast);
  const shared = useList(collaborator, () => sharedBackend(account), setToast);
  const ownerOf = useCallback(
    (paperId: string) => ACCOUNTS.find((other) => mockStore(storeKeyOf(other.login)).papers.some((paper) => paper.id === paperId)),
    [],
  );
  const value = useMemo<AccountValue>(
    () => ({ account, mine, shared, ownerOf, organizer, organize, touchPaper, toast, setToast }),
    [account, mine, shared, ownerOf, organizer, organize, touchPaper, toast],
  );
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
};
