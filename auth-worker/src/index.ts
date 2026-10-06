/**
 * Exchanges a GitHub login code for a user token, but only for the site owner.
 * GitHub requires the client secret for this exchange and its endpoint has no CORS,
 * so the static site cannot do it in the browser. The worker stores nothing.
 */
export interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  OWNER_LOGIN: string;
  /** Comma-separated site origins, e.g. "https://zihanzhao1022.github.io,http://localhost:3000". */
  ALLOWED_ORIGINS: string;
}

// GitHub App user tokens expire after 8 hours unless the app opts out.
const DEFAULT_TOKEN_SECONDS = 8 * 60 * 60;

type Headers = Record<string, string>;

const githubHeaders = (authorization: string): Headers => ({
  Accept: 'application/vnd.github+json',
  Authorization: authorization,
  'User-Agent': 'homepage-auth-worker',
  'X-GitHub-Api-Version': '2022-11-28',
});

const json = (body: unknown, status: number, cors: Headers): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function revoke(env: Env, accessToken: string): Promise<void> {
  const basic = btoa(`${env.GITHUB_CLIENT_ID}:${env.GITHUB_CLIENT_SECRET}`);
  await fetch(`https://api.github.com/applications/${env.GITHUB_CLIENT_ID}/token`, {
    method: 'DELETE',
    headers: { ...githubHeaders(`Basic ${basic}`), 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: accessToken }),
  });
}

async function exchange(body: Record<string, unknown>, env: Env, origins: string[], cors: Headers): Promise<Response> {
  const { code, code_verifier: verifier, redirect_uri: redirectUri } = body;
  if (typeof code !== 'string' || typeof verifier !== 'string' || typeof redirectUri !== 'string') {
    return json({ error: 'bad_request' }, 400, cors);
  }
  if (!origins.some((origin) => redirectUri === `${origin}/`)) {
    return json({ error: 'bad_redirect_uri' }, 400, cors);
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
    }),
  });
  const token = (await tokenRes.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!token.access_token) {
    return json({ error: token.error ?? 'token_exchange_failed' }, 400, cors);
  }

  const userRes = await fetch('https://api.github.com/user', { headers: githubHeaders(`Bearer ${token.access_token}`) });
  const user = userRes.ok ? ((await userRes.json()) as { login: string; avatar_url: string }) : null;
  if (!user || user.login.toLowerCase() !== env.OWNER_LOGIN.toLowerCase()) {
    await revoke(env, token.access_token);
    return user ? json({ error: 'not_owner' }, 403, cors) : json({ error: 'user_lookup_failed' }, 502, cors);
  }

  const seconds = token.expires_in ?? DEFAULT_TOKEN_SECONDS;
  return json(
    {
      access_token: token.access_token,
      expires_at: Date.now() + seconds * 1000,
      login: user.login,
      avatar_url: user.avatar_url,
    },
    200,
    cors,
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origins = env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
    const origin = request.headers.get('Origin') ?? '';
    if (!origins.includes(origin)) return new Response('Forbidden', { status: 403 });

    const cors: Headers = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const { pathname } = new URL(request.url);
    if (request.method !== 'POST' || (pathname !== '/token' && pathname !== '/revoke')) {
      return json({ error: 'not_found' }, 404, cors);
    }
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') return json({ error: 'bad_request' }, 400, cors);

    if (pathname === '/token') return exchange(body, env, origins, cors);

    if (typeof body.access_token !== 'string') return json({ error: 'bad_request' }, 400, cors);
    await revoke(env, body.access_token);
    return new Response(null, { status: 204, headers: cors });
  },
};
