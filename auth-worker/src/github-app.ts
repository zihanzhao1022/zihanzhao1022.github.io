import { appJwt } from './crypto';

/** What the worker needs to act as the GitHub App on the private repository. */
export interface AppEnv {
  GITHUB_CLIENT_ID: string;
  OWNER_LOGIN: string;
  /** The private repository with the results pages, e.g. "homepage-private" (owned by OWNER_LOGIN). */
  PRIVATE_REPO?: string;
  /** The GitHub App's private key (PEM), stored with `wrangler secret put GITHUB_APP_PRIVATE_KEY`. */
  GITHUB_APP_PRIVATE_KEY?: string;
}

export const USER_AGENT = 'homepage-auth-worker';

export const githubHeaders = (authorization: string): Record<string, string> => ({
  Accept: 'application/vnd.github+json',
  Authorization: authorization,
  'User-Agent': USER_AGENT,
  'X-GitHub-Api-Version': '2022-11-28',
});

/** Installation tokens last an hour; one is replaced this long before it expires. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

let cached: { key: string; token: string; expiresAt: number } | null = null;

/** Drops the cached token (tests, and a token GitHub no longer accepts). */
export function forgetInstallationToken(): void {
  cached = null;
}

/**
 * A token that can read and write the contents of the private repository and nothing else. The worker uses
 * it on behalf of collaborators, who never get a token of their own. Kept in memory until shortly before
 * it expires.
 */
export async function installationToken(env: AppEnv, now = Date.now()): Promise<string> {
  const repo = env.PRIVATE_REPO ?? '';
  const key = `${env.GITHUB_CLIENT_ID}/${env.OWNER_LOGIN}/${repo}`;
  if (cached && cached.key === key && cached.expiresAt - REFRESH_MARGIN_MS > now) return cached.token;
  if (!env.GITHUB_APP_PRIVATE_KEY || !repo) throw new Error('GitHub App private key or private repository not configured');

  const headers = githubHeaders(`Bearer ${await appJwt(env.GITHUB_CLIENT_ID, env.GITHUB_APP_PRIVATE_KEY, now)}`);
  const installation = await fetch(`https://api.github.com/repos/${env.OWNER_LOGIN}/${repo}/installation`, { headers });
  if (!installation.ok) throw new Error(`GitHub App installation lookup failed (${installation.status})`);
  const { id } = (await installation.json()) as { id: number };

  const res = await fetch(`https://api.github.com/app/installations/${id}/access_tokens`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ repositories: [repo], permissions: { contents: 'write' } }),
  });
  if (!res.ok) throw new Error(`GitHub App installation token failed (${res.status})`);
  const { token, expires_at: expiresAt } = (await res.json()) as { token: string; expires_at: string };
  cached = { key, token, expiresAt: Date.parse(expiresAt) };
  return token;
}
