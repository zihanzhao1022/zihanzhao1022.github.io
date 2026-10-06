export interface Session {
  token: string;
  login: string;
  avatarUrl: string;
  /** Epoch milliseconds. */
  expiresAt: number;
}

/** Kept in sessionStorage while the browser is away at GitHub. */
export interface PendingLogin {
  state: string;
  verifier: string;
  returnHash: string;
}

/** What GitHub put in the query string when it redirected back. */
export interface LoginCallback {
  code: string | null;
  state: string | null;
  error: string | null;
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const SESSION_KEY = 'homepage-editor-session';
const PENDING_KEY = 'homepage-editor-login';
const EXPIRY_WARNING_MS = 15 * 60 * 1000;

/** True only under `npm run dev:mock`; production builds compile this to false. */
export const MOCK_MODE = import.meta.env.DEV && import.meta.env.VITE_EDITOR_MOCK === 'true';

// Browser storage can be missing or throw (private mode, blocked site data).
const localStore = (): StorageLike | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const sessionStore = (): StorageLike | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

function readJson<T>(storage: StorageLike | null, key: string): T | null {
  try {
    const raw = storage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(storage: StorageLike | null, key: string, value: unknown): void {
  try {
    if (value === null) storage?.removeItem(key);
    else storage?.setItem(key, JSON.stringify(value));
  } catch {
    // The value simply won't persist.
  }
}

export function loadSession(storage = localStore(), now = Date.now()): Session | null {
  const value = readJson<Partial<Session>>(storage, SESSION_KEY);
  if (!value) return null;
  const valid =
    typeof value.token === 'string' &&
    typeof value.login === 'string' &&
    typeof value.expiresAt === 'number' &&
    value.expiresAt > now;
  if (!valid) {
    writeJson(storage, SESSION_KEY, null);
    return null;
  }
  return {
    token: value.token as string,
    login: value.login as string,
    avatarUrl: typeof value.avatarUrl === 'string' ? value.avatarUrl : '',
    expiresAt: value.expiresAt as number,
  };
}

export const saveSession = (value: Session, storage = localStore()): void => writeJson(storage, SESSION_KEY, value);

export const clearSession = (storage = localStore()): void => writeJson(storage, SESSION_KEY, null);

export const isExpiringSoon = (value: Session, now = Date.now()): boolean => value.expiresAt - now < EXPIRY_WARNING_MS;

/** Only internal routes such as "#/publications" survive the login round trip. */
export const safeReturnHash = (hash: string | null | undefined): string =>
  hash && /^#\/(?!\/)[A-Za-z0-9/_-]*$/.test(hash) ? hash : '#/';

export const savePendingLogin = (value: PendingLogin, storage = sessionStore()): void =>
  writeJson(storage, PENDING_KEY, value);

export const readPendingLogin = (storage = sessionStore()): PendingLogin | null =>
  readJson<PendingLogin>(storage, PENDING_KEY);

export const clearPendingLogin = (storage = sessionStore()): void => writeJson(storage, PENDING_KEY, null);

/**
 * Takes GitHub's ?code=…&state=… (or ?error=…) out of the address bar before the router starts,
 * and puts back the page the owner was on. Returns null on ordinary page loads.
 */
export function takeLoginCallback(): LoginCallback | null {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('code') && !params.has('error')) return null;
  const returnHash = safeReturnHash(readPendingLogin()?.returnHash);
  window.history.replaceState(null, '', window.location.pathname + returnHash);
  return { code: params.get('code'), state: params.get('state'), error: params.get('error') };
}
