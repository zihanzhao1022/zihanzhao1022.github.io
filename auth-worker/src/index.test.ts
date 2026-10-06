import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, { Env } from './index';

const SITE = 'https://zihanzhao1022.github.io';

const env: Env = {
  GITHUB_CLIENT_ID: 'Iv1.test',
  GITHUB_CLIENT_SECRET: 'secret',
  OWNER_LOGIN: 'zihanzhao1022',
  ALLOWED_ORIGINS: `${SITE},http://localhost:3000`,
};

const post = (path: string, body: unknown, origin = SITE) =>
  worker.fetch(
    new Request(`https://auth.example${path}`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env,
  );

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });

// Fakes the three GitHub endpoints the worker talks to.
function stubGitHub(replies: { token: unknown; user?: unknown }) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    if (url === 'https://github.com/login/oauth/access_token') return jsonResponse(replies.token);
    if (url === 'https://api.github.com/user') return jsonResponse(replies.user);
    if (url.startsWith('https://api.github.com/applications/')) return new Response(null, { status: 204 });
    throw new Error(`unexpected fetch: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const callTo = (fetchMock: ReturnType<typeof stubGitHub>, fragment: string) =>
  fetchMock.mock.calls.find(([url]) => String(url).includes(fragment));

const validLogin = { code: 'the-code', code_verifier: 'the-verifier', redirect_uri: `${SITE}/` };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('auth worker', () => {
  it('answers CORS preflight for allowed origins', async () => {
    const res = await worker.fetch(
      new Request('https://auth.example/token', { method: 'OPTIONS', headers: { Origin: SITE } }),
      env,
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
  });

  it('rejects requests from other origins', async () => {
    const res = await post('/token', validLogin, 'https://evil.example');
    expect(res.status).toBe(403);
  });

  it('rejects unknown redirect URIs without calling GitHub', async () => {
    const fetchMock = stubGitHub({ token: {} });
    const res = await post('/token', { ...validLogin, redirect_uri: 'https://evil.example/' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_redirect_uri' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a token for the owner', async () => {
    const fetchMock = stubGitHub({
      token: { access_token: 'ghu_owner', expires_in: 28800 },
      user: { login: 'ZihanZhao1022', avatar_url: 'https://avatars.example/me' },
    });
    const before = Date.now();
    const res = await post('/token', validLogin);

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    const body = await res.json();
    expect(body).toMatchObject({
      access_token: 'ghu_owner',
      login: 'ZihanZhao1022',
      avatar_url: 'https://avatars.example/me',
    });
    expect(body.expires_at).toBeGreaterThanOrEqual(before + 28800 * 1000);

    const exchange = callTo(fetchMock, 'login/oauth/access_token');
    expect(JSON.parse(String(exchange?.[1]?.body))).toEqual({
      client_id: 'Iv1.test',
      client_secret: 'secret',
      code: 'the-code',
      code_verifier: 'the-verifier',
      redirect_uri: `${SITE}/`,
    });
  });

  it('revokes the token of anyone else', async () => {
    const fetchMock = stubGitHub({
      token: { access_token: 'ghu_stranger' },
      user: { login: 'someone-else', avatar_url: '' },
    });
    const res = await post('/token', validLogin);

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'not_owner' });
    const revoke = callTo(fetchMock, '/applications/Iv1.test/token');
    expect(revoke?.[1]?.method).toBe('DELETE');
    expect((revoke?.[1]?.headers as Record<string, string>).Authorization).toBe(`Basic ${btoa('Iv1.test:secret')}`);
    expect(JSON.parse(String(revoke?.[1]?.body))).toEqual({ access_token: 'ghu_stranger' });
  });

  it('passes GitHub exchange errors through', async () => {
    stubGitHub({ token: { error: 'bad_verification_code' } });
    const res = await post('/token', validLogin);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_verification_code' });
  });

  it('revokes tokens on logout', async () => {
    const fetchMock = stubGitHub({ token: {} });
    const res = await post('/revoke', { access_token: 'ghu_owner' });
    expect(res.status).toBe(204);
    expect(JSON.parse(String(callTo(fetchMock, '/applications/')?.[1]?.body))).toEqual({ access_token: 'ghu_owner' });
  });

  it('returns 404 for unknown paths', async () => {
    const res = await post('/elsewhere', {});
    expect(res.status).toBe(404);
  });
});
