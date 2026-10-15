import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { bundledContent } from '../content';
import { EditorToast, useResultsEditor } from '../editor/results/useResults';
import { createMockCollaboratorBackend, createMockResultsBackend, mockStore, seedMockStore } from '../editor/results/mockBackend';
import { ResultsBackend } from '../editor/results/backend';
import { WorkerError } from '../editor/results/workerBackend';
import { SiteContent } from '../types';
import { ACCOUNTS, Account, collaboratorSession, ownerSession, storeKeyOf } from './accounts';
import { copyPaper } from './library';

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

const SEEDED_KEY = 'galley-seeded-v1';

/**
 * Once per browser: Alice shares a copy of the first account's first compiled paper with it, so the list of
 * papers shared with you has something in it.
 */
function seedExample(): void {
  try {
    if (localStorage.getItem(SEEDED_KEY)) return;
    localStorage.setItem(SEEDED_KEY, '1');
  } catch {
    return;
  }
  const [first, alice] = ACCOUNTS;
  const source = mockStore(storeKeyOf(first.login));
  const paper = source.papers.find((item) => item.blocks.some((block) => block.output));
  if (!paper) return;
  const copy = copyPaper(paper, source.read, `res-alice-${Date.now().toString(36)}`, {
    slug: 'made-up-shared-paper',
    title: 'Made-up shared paper',
    authors: ['**Alice Chen**', 'Zihan Zhao'],
    hidden: true,
    viewers: [first.login],
    collaboratorIds: { [first.login.toLowerCase()]: first.id },
  });
  seedMockStore(storeKeyOf(alice.login), [copy.paper], copy.files);
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
    connect: () => Promise.resolve(connect()),
  });
  return { ...editor, content };
}

/** The signed-in account's papers: its own and those shared with it. */
export const AccountProvider: React.FC<{ account: Account; children: React.ReactNode }> = ({ account, children }) => {
  const [toast, setToast] = useState<EditorToast | null>(null);
  // The example is in place before the lists load.
  useState(() => seedExample());
  const owner = useMemo(() => ownerSession(account), [account]);
  const collaborator = useMemo(() => collaboratorSession(account), [account]);
  const mine = useList(owner, () => createMockResultsBackend(storeKeyOf(account.login)), setToast);
  const shared = useList(collaborator, () => sharedBackend(account), setToast);
  const ownerOf = useCallback(
    (paperId: string) => ACCOUNTS.find((other) => mockStore(storeKeyOf(other.login)).papers.some((paper) => paper.id === paperId)),
    [],
  );
  const value = useMemo<AccountValue>(() => ({ account, mine, shared, ownerOf, toast, setToast }), [account, mine, shared, ownerOf, toast]);
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
};
