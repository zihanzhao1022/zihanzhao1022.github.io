import { EDITOR_CONFIG } from './config';
import {
  LoginCallback,
  MOCK_MODE,
  PendingLogin,
  Session,
  clearPendingLogin,
  clearSession,
  readPendingLogin,
  safeReturnHash,
  savePendingLogin,
  saveSession,
} from '../lib/session';

/** A login failure whose message can be shown to the owner as is. */
export class LoginError extends Error {}

/** A GitHub account with no access yet: it may ask the owner for it with `token` (see requestAccess). */
export class AccessDenied extends LoginError {
  constructor(
    readonly token: string,
    readonly login: string,
    readonly avatarUrl: string,
  ) {
    super('这个 GitHub 账号还没有访问权限');
  }
}

const MOCK_SESSION_MS = 8 * 60 * 60 * 1000;

const workerUrl = (path: string): string => `${EDITOR_CONFIG.workerUrl.replace(/\/+$/, '')}${path}`;

const redirectUri = (): string => `${window.location.origin}/`;

const base64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const randomToken = (): string => base64Url(crypto.getRandomValues(new Uint8Array(32)));

/** PKCE S256 challenge for a verifier (RFC 7636). */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

export function buildAuthorizeUrl(options: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
}): string {
  const query = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    state: options.state,
    code_challenge: options.challenge,
    code_challenge_method: 'S256',
  });
  return `https://github.com/login/oauth/authorize?${query.toString()}`;
}

/** Checks GitHub's redirect against the login this browser started. */
export function checkCallback(callback: LoginCallback, pending: PendingLogin | null): { code: string; verifier: string } {
  if (callback.error) {
    throw new LoginError(callback.error === 'access_denied' ? '已取消登录' : `GitHub 登录失败（${callback.error}）`);
  }
  if (!pending || !callback.code || callback.state !== pending.state) {
    throw new LoginError('登录校验失败，请重新登录');
  }
  return { code: callback.code, verifier: pending.verifier };
}

/** Trades the authorization code for a token through the Cloudflare Worker. */
export async function exchangeCode(
  code: string,
  verifier: string,
  redirect: string,
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
): Promise<Session> {
  let res: Response;
  try {
    res = await fetchImpl(workerUrl('/token'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, code_verifier: verifier, redirect_uri: redirect }),
    });
  } catch {
    throw new LoginError('无法连接登录服务，请稍后重试');
  }
  if (res.status === 403) {
    const refused = (await res.json().catch(() => ({}))) as { request?: unknown; login?: unknown; avatar_url?: unknown };
    if (typeof refused.request === 'string' && typeof refused.login === 'string') {
      throw new AccessDenied(refused.request, refused.login, typeof refused.avatar_url === 'string' ? refused.avatar_url : '');
    }
    throw new LoginError('这个 GitHub 账号没有访问权限');
  }
  if (!res.ok) throw new LoginError('登录失败，请重新登录');
  const data = (await res.json()) as {
    access_token?: string;
    role?: string;
    session?: string;
    expires_at: number;
    login: string;
    avatar_url: string;
  };
  // Someone the owner shared results papers with gets a session with the worker instead of a GitHub token.
  if (data.role === 'collaborator' && data.session) {
    return { token: data.session, login: data.login, avatarUrl: data.avatar_url, expiresAt: data.expires_at, role: 'collaborator' };
  }
  return { token: data.access_token ?? '', login: data.login, avatarUrl: data.avatar_url, expiresAt: data.expires_at };
}

/** The GitHub account ID mock mode makes up for a user name. */
export const mockUserId = (login: string): number =>
  [...login.toLowerCase()].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 1_000_000, 7) + 1000;

/** Mock mode signs in as the owner, or as a collaborator after localStorage.setItem('mock-login', 'alice'). */
function mockSession(): Session {
  let login: string | null = null;
  try {
    login = localStorage.getItem('mock-login');
  } catch {
    // Signs in as the owner.
  }
  const expiresAt = Date.now() + MOCK_SESSION_MS;
  if (login && login !== EDITOR_CONFIG.owner) {
    // The mock "worker session" is just who it belongs to.
    return { token: JSON.stringify({ login, id: mockUserId(login) }), login, avatarUrl: '', expiresAt, role: 'collaborator' };
  }
  return { token: 'mock-token', login: EDITOR_CONFIG.owner, avatarUrl: '', expiresAt };
}

/** Sends the browser to GitHub. In mock mode it signs in on the spot and returns the session. */
export async function startLogin(): Promise<Session | null> {
  if (MOCK_MODE) {
    const session = mockSession();
    if (session.role === 'collaborator') {
      // Like the worker: someone on no list may only ask for access.
      const { mockMayEnter } = await import('./results/mockBackend');
      if (!mockMayEnter(JSON.parse(session.token) as { login: string; id: number })) {
        throw new AccessDenied(session.token, session.login, '');
      }
    }
    saveSession(session);
    return session;
  }
  const state = randomToken();
  const verifier = randomToken();
  savePendingLogin({ state, verifier, returnHash: safeReturnHash(window.location.hash) });
  const challenge = await pkceChallenge(verifier);
  window.location.assign(buildAuthorizeUrl({ clientId: EDITOR_CONFIG.clientId, redirectUri: redirectUri(), state, challenge }));
  return null;
}

/** Finishes the login GitHub redirected back with (see takeLoginCallback). */
export async function completeLogin(callback: LoginCallback): Promise<Session> {
  const pending = readPendingLogin();
  clearPendingLogin();
  const { code, verifier } = checkCallback(callback, pending);
  const session = await exchangeCode(code, verifier, redirectUri());
  saveSession(session);
  return session;
}

export async function logout(session: Session): Promise<void> {
  clearSession();
  // A collaborator's GitHub token was revoked at login; their worker session simply expires.
  if (MOCK_MODE || session.role === 'collaborator') return;
  try {
    await fetch(workerUrl('/revoke'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: session.token }),
    });
  } catch {
    // The token still expires on its own within 8 hours.
  }
}

/** Asks the owner for access to the results pages, with the token a refused login gave (see AccessDenied). */
export async function requestAccess(token: string, note: string): Promise<void> {
  if (MOCK_MODE) {
    const { mockRequestAccess } = await import('./results/mockBackend');
    mockRequestAccess(JSON.parse(token) as { login: string; id: number }, note);
    return;
  }
  let res: Response;
  try {
    res = await fetch(workerUrl('/access/request'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ note }),
    });
  } catch {
    throw new LoginError('无法连接服务器，请稍后重试');
  }
  if (res.status === 409) throw new LoginError('你已经有访问权限了，请重新登录');
  if (res.status === 401) throw new LoginError('登录已过期，请重新登录后再申请');
  if (res.status === 429) throw new LoginError('现在等待处理的申请太多了，请过几天再试');
  if (!res.ok) throw new LoginError('申请没有发出去，请稍后重试');
}
