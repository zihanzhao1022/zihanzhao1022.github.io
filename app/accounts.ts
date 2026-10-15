import { mockUserId } from '../editor/auth';
import { STORE_KEY } from '../editor/results/mockBackend';
import { Session } from '../lib/session';

/** A made-up GitHub account of the prototype. Each has its own repository: a mock store in this browser. */
export interface Account {
  login: string;
  id: number;
  name: string;
}

export const ACCOUNTS: Account[] = [
  { login: 'zihanzhao1022', name: 'Zihan Zhao' },
  { login: 'alice', name: 'Alice Chen' },
  { login: 'bob', name: 'Bob Tanaka' },
].map((account) => ({ ...account, id: mockUserId(account.login) }));

export const accountOf = (login: string): Account | undefined => ACCOUNTS.find((account) => account.login.toLowerCase() === login.toLowerCase());

/** An account's repository: the first account's is the one `npm run dev:mock` gives the homepage. */
export const storeKeyOf = (login: string): string => (login === ACCOUNTS[0].login ? STORE_KEY : `${STORE_KEY}:${login.toLowerCase()}`);

const SESSION_KEY = 'galley-session';
const REPOS_KEY = 'galley-repos';

function read<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? 'null') as T | null) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The prototype simply forgets.
  }
}

export const signedIn = (): Account | null => accountOf(read<string>(SESSION_KEY, '')) ?? null;
export const signIn = (account: Account): void => write(SESSION_KEY, account.login);
export const signOut = (): void => write(SESSION_KEY, null);

/** The repository each account connected; the first two start connected, so there is something to look at. */
export function connectedRepo(login: string): string | null {
  const repos = read<Record<string, string>>(REPOS_KEY, { [ACCOUNTS[0].login]: `${ACCOUNTS[0].login}/results`, alice: 'alice/paper-results' });
  return repos[login] ?? null;
}

export function connectRepo(login: string, repo: string): void {
  const repos = read<Record<string, string>>(REPOS_KEY, { [ACCOUNTS[0].login]: `${ACCOUNTS[0].login}/results`, alice: 'alice/paper-results' });
  write(REPOS_KEY, { ...repos, [login]: repo });
}

// A month: the prototype never asks to sign in again.
const LONG = 30 * 24 * 60 * 60 * 1000;

/** The account as the owner of its repository, for the results editor. */
export const ownerSession = (account: Account): Session => ({ login: account.login, token: 'mock-token', avatarUrl: '', expiresAt: Date.now() + LONG });

/** The account as a collaborator on others' papers (the mock worker session is who it belongs to). */
export const collaboratorSession = (account: Account): Session => ({
  login: account.login,
  token: JSON.stringify({ login: account.login, id: account.id }),
  avatarUrl: '',
  expiresAt: Date.now() + LONG,
  role: 'collaborator',
});
