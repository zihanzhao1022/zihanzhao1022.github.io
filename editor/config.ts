/**
 * Public identifiers for the edit mode. The GitHub App's client secret lives only in the
 * Cloudflare Worker (see auth-worker/), never in this repository.
 */
export const EDITOR_CONFIG = {
  owner: 'zihanzhao1022',
  repo: 'zihanzhao1022.github.io',
  branch: 'main',
  /** Private repository with the unpublished results pages (same owner and branch, same GitHub App). */
  privateRepo: 'homepage-private',
  /** GitHub App client ID. */
  clientId: 'Iv23liGqrkAjs9Kn7RKo',
  /** Cloudflare Worker URL without a trailing slash, e.g. https://homepage-auth.<subdomain>.workers.dev */
  workerUrl: 'https://homepage-auth.zihanzhao1022.workers.dev',
};

/** The login entry stays hidden until both values are filled in. */
export const loginConfigured = (): boolean => EDITOR_CONFIG.clientId !== '' && EDITOR_CONFIG.workerUrl !== '';
