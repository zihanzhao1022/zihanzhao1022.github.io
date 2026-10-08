import { describe, expect, it, vi } from 'vitest';
import { LoginError, buildAuthorizeUrl, checkCallback, exchangeCode, pkceChallenge } from './auth';

describe('pkceChallenge', () => {
  it('matches the RFC 7636 example', async () => {
    expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });
});

describe('buildAuthorizeUrl', () => {
  it('asks GitHub for an S256 PKCE login', () => {
    const url = new URL(
      buildAuthorizeUrl({ clientId: 'Iv23abc', redirectUri: 'https://zihanzhao1022.github.io/', state: 's1', challenge: 'c1' }),
    );
    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'Iv23abc',
      redirect_uri: 'https://zihanzhao1022.github.io/',
      state: 's1',
      code_challenge: 'c1',
      code_challenge_method: 'S256',
    });
  });
});

describe('checkCallback', () => {
  const pending = { state: 's1', verifier: 'v1', returnHash: '#/' };

  it('returns the code and verifier when the state matches', () => {
    expect(checkCallback({ code: 'c', state: 's1', error: null }, pending)).toEqual({ code: 'c', verifier: 'v1' });
  });

  it('rejects a mismatched or missing state', () => {
    expect(() => checkCallback({ code: 'c', state: 'other', error: null }, pending)).toThrow('登录校验失败');
    expect(() => checkCallback({ code: 'c', state: 's1', error: null }, null)).toThrow(LoginError);
  });

  it('reports a cancelled login', () => {
    expect(() => checkCallback({ code: null, state: 's1', error: 'access_denied' }, pending)).toThrow('已取消登录');
  });
});

describe('exchangeCode', () => {
  const reply = (status: number, body: unknown) =>
    vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));

  it('turns the worker reply into a session', async () => {
    const fetchMock = reply(200, {
      access_token: 'ghu_x',
      expires_at: 123,
      login: 'zihanzhao1022',
      avatar_url: 'https://avatars.example/x',
    });
    expect(await exchangeCode('c', 'v', 'https://zihanzhao1022.github.io/', fetchMock)).toEqual({
      token: 'ghu_x',
      expiresAt: 123,
      login: 'zihanzhao1022',
      avatarUrl: 'https://avatars.example/x',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/token$/);
    expect(JSON.parse(String(init?.body))).toEqual({
      code: 'c',
      code_verifier: 'v',
      redirect_uri: 'https://zihanzhao1022.github.io/',
    });
  });

  it('keeps the worker session of a collaborator, who gets no GitHub token', async () => {
    const fetchMock = reply(200, { role: 'collaborator', session: 'payload.signature', expires_at: 456, login: 'alice', avatar_url: '' });
    expect(await exchangeCode('c', 'v', 'r', fetchMock)).toEqual({
      token: 'payload.signature',
      expiresAt: 456,
      login: 'alice',
      avatarUrl: '',
      role: 'collaborator',
    });
  });

  it('explains a refused account', async () => {
    await expect(exchangeCode('c', 'v', 'r', reply(403, { error: 'not_owner' }))).rejects.toThrow('这个 GitHub 账号没有访问权限');
  });

  it('explains other failures', async () => {
    await expect(exchangeCode('c', 'v', 'r', reply(400, { error: 'bad_verification_code' }))).rejects.toThrow('登录失败');
    const offline = vi.fn(async () => {
      throw new TypeError('offline');
    });
    await expect(exchangeCode('c', 'v', 'r', offline)).rejects.toThrow('无法连接登录服务');
  });
});
