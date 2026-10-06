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
  if (res.status === 403) throw new LoginError('该账号没有编辑权限');
  if (!res.ok) throw new LoginError('登录失败，请重新登录');
  const data = (await res.json()) as { access_token: string; expires_at: number; login: string; avatar_url: string };
  return { token: data.access_token, login: data.login, avatarUrl: data.avatar_url, expiresAt: data.expires_at };
}

/** Sends the browser to GitHub. In mock mode it signs in on the spot and returns the session. */
export async function startLogin(): Promise<Session | null> {
  if (MOCK_MODE) {
    const session: Session = {
      token: 'mock-token',
      login: EDITOR_CONFIG.owner,
      avatarUrl: '',
      expiresAt: Date.now() + MOCK_SESSION_MS,
    };
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
  if (MOCK_MODE) return;
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
