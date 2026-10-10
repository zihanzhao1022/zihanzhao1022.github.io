/**
 * The results pages for collaborators: people the owner listed on a paper (see editor/results/collaborators.ts).
 * They sign in with GitHub like the owner, but keep no GitHub token: the worker gives them a session of its
 * own and reads and writes the private repository for them with the GitHub App's installation token,
 * checking every request against the latest lists. They never touch the site's repository.
 */
import { ConflictError } from '../../editor/errors';
import { GitHubApi, GitHubError, TreeEntry, createGitHubApi } from '../../editor/github';
import { RESULTS_PATH, commitResults, parsePapers, readTextFile } from '../../editor/results/backend';
import {
  GitHubUser,
  canReadFile,
  checkEditorOp,
  hasAnyRole,
  isPaperPath,
  paperOfPath,
  papersFor,
  roleOf,
} from '../../editor/results/collaborators';
import { ResultsOp } from '../../editor/results/ops';
import { ResultPaper } from '../../types';
import { signSession, signText, verifySession, verifyText } from './crypto';
import { AppEnv, USER_AGENT, forgetInstallationToken, installationToken } from './github-app';
import { Headers, json } from './http';

export interface ResultsEnv extends AppEnv {
  /** Signs collaborator sessions and upload receipts; stored with `wrangler secret put SESSION_SECRET`. */
  SESSION_SECRET?: string;
  /** "true" lets editors edit; otherwise everyone on a paper's lists can only view it. */
  COLLABORATOR_EDITING?: string;
}

const editingEnabled = (env: ResultsEnv): boolean => env.COLLABORATOR_EDITING === 'true';

const BRANCH = 'main';
/** How long a collaborator stays signed in (as long as the owner's GitHub token). */
export const SESSION_MS = 8 * 60 * 60 * 1000;
/**
 * The largest file a collaborator can upload. Cloudflare's free plan gives a worker 10 ms of CPU per request,
 * and every byte passes through it as base64 text.
 */
export const UPLOAD_LIMIT = 1024 * 1024;
const UPLOAD_LIMIT_BASE64 = Math.ceil(UPLOAD_LIMIT / 3) * 4;
/** Other requests carry block sources and compile bookkeeping, never file contents. */
const BODY_LIMIT = 2 * 1024 * 1024;
const MAX_FILES = 200;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

type Untrusted = Record<string, unknown>;

/** Collaborators need the App's private key, the session secret and the private repository's name. */
export const collaboratorsEnabled = (env: ResultsEnv): boolean =>
  Boolean(env.GITHUB_APP_PRIVATE_KEY && env.SESSION_SECRET && env.PRIVATE_REPO);

/** The private repository, through the installation token. */
async function privateRepo(env: ResultsEnv): Promise<GitHubApi> {
  const token = await installationToken(env);
  return createGitHubApi(token, { owner: env.OWNER_LOGIN, repo: env.PRIVATE_REPO ?? '', branch: BRANCH }, (input, init) => {
    // GitHub needs a User-Agent, which a worker's fetch does not add; the API's private max-age is never cached here.
    const { cache: _cache, ...rest } = init ?? {};
    return fetch(input, {
      ...rest,
      headers: { ...(rest.headers as Record<string, string>), 'User-Agent': USER_AGENT, 'X-GitHub-Api-Version': '2022-11-28' },
    });
  });
}

const loadPapers = async (api: GitHubApi): Promise<ResultPaper[]> => parsePapers(await readTextFile(api, RESULTS_PATH, BRANCH));

/** The private list of papers, read with the installation token (for checks outside these endpoints). */
export const readPapers = async (env: ResultsEnv): Promise<ResultPaper[]> => loadPapers(await privateRepo(env));

const isEditorOf = (papers: ResultPaper[], paperId: string, user: GitHubUser, env: ResultsEnv): boolean => {
  const paper = papers.find((item) => item.id === paperId);
  return editingEnabled(env) && paper !== undefined && roleOf(paper, user) === 'editor';
};

/** Ties an uploaded blob to who uploaded it and where it may go, so a save only commits the worker's own uploads. */
const receiptText = (user: GitHubUser, path: string, sha: string): string => `upload:${user.id}:${path}:${sha}`;

/** Collaborators' commits in the private repository say who made them. */
function commitMessage(message: unknown, user: GitHubUser): string {
  const text = typeof message === 'string' ? message.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
  return `${text || 'results: update'} (by ${user.login})`;
}

class Forbidden extends Error {}

/**
 * Answers a successful GitHub login of someone other than the owner: a session if a paper is shared with
 * them, 403 otherwise. Their GitHub token has already been revoked.
 */
export async function collaboratorLogin(user: GitHubUser & { avatar_url: string }, env: ResultsEnv, cors: Headers): Promise<Response> {
  if (!collaboratorsEnabled(env)) return json({ error: 'not_owner' }, 403, cors);
  let papers: ResultPaper[];
  try {
    papers = await loadPapers(await privateRepo(env));
  } catch (error) {
    console.error('results: reading the private repository failed', error instanceof Error ? error.message : error);
    return json({ error: 'private_unavailable' }, 502, cors);
  }
  if (!hasAnyRole(papers, user)) return json({ error: 'not_owner' }, 403, cors);
  const expiresAt = Date.now() + SESSION_MS;
  return json(
    {
      role: 'collaborator',
      session: await signSession({ login: user.login, id: user.id, exp: expiresAt }, env.SESSION_SECRET ?? ''),
      expires_at: expiresAt,
      login: user.login,
      avatar_url: user.avatar_url,
    },
    200,
    cors,
  );
}

async function sessionUser(request: Request, secret: string): Promise<GitHubUser | null> {
  const match = /^Bearer ([\w-]+\.[\w-]+)$/.exec(request.headers.get('Authorization') ?? '');
  const claims = match ? await verifySession(match[1], secret) : null;
  return claims ? { login: claims.login, id: claims.id } : null;
}

async function readBody(request: Request, limit: number): Promise<Untrusted | 'too_large' | null> {
  if (Number(request.headers.get('Content-Length') ?? 0) > limit) return 'too_large';
  const text = await request.text();
  if (text.length > limit) return 'too_large';
  try {
    const body: unknown = JSON.parse(text);
    return typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Untrusted) : null;
  } catch {
    return null;
  }
}

type Handler = (api: GitHubApi, user: GitHubUser, body: Untrusted, env: ResultsEnv, cors: Headers) => Promise<Response>;

const badRequest = (cors: Headers, message?: string): Response => json({ error: 'bad_request', message }, 400, cors);
const forbidden = (cors: Headers): Response => json({ error: 'forbidden' }, 403, cors);

const HANDLERS: Record<string, Handler> = {
  /** The papers shared with the collaborator; 403 once no paper is. */
  async '/results/load'(api, user, _body, env, cors) {
    const shared = papersFor(await loadPapers(api), user, editingEnabled(env));
    return shared.papers.length > 0 ? json(shared, 200, cors) : json({ error: 'not_shared' }, 403, cors);
  },

  /** One file of a shared paper: { path }. */
  async '/results/file'(api, user, body, env, cors) {
    const { path } = body;
    const paperId = typeof path === 'string' ? paperOfPath(path) : null;
    if (typeof path !== 'string' || !paperId) return badRequest(cors);
    const paper = (await loadPapers(api)).find((item) => item.id === paperId);
    const found = paper ? roleOf(paper, user) : null;
    const role = found === 'editor' && !editingEnabled(env) ? 'viewer' : found;
    if (!paper || !role || !canReadFile(paper, role, path)) return forbidden(cors);
    const bytes = await api.readBytes(path, BRANCH);
    return new Response(bytes, { headers: { ...cors, 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' } });
  },

  /** Stores one file for an editor's next save: { paperId, path, base64 } → { path, sha, receipt }. */
  async '/results/upload'(api, user, body, env, cors) {
    const secret = env.SESSION_SECRET ?? '';
    const { paperId, path, base64 } = body;
    if (typeof paperId !== 'string' || typeof path !== 'string' || !isPaperPath(paperId, path)) return badRequest(cors, '文件位置不对');
    if (typeof base64 !== 'string' || !BASE64.test(base64)) return badRequest(cors);
    if (base64.length > UPLOAD_LIMIT_BASE64) return json({ error: 'too_large' }, 413, cors);
    if (!isEditorOf(await loadPapers(api), paperId, user, env)) return forbidden(cors);
    const sha = await api.createBlob(base64);
    return json({ path, sha, receipt: await signText(receiptText(user, path, sha), secret) }, 200, cors);
  },

  /**
   * An editor's edit to one paper: { paperId, op, blobs: [{ path, sha, receipt }], deletes, message }.
   * Answers with the papers shared with them after the edit. Edits to a published paper wait for the
   * owner before they reach the site (see the noteEdit operation).
   */
  async '/results/save'(api, user, body, env, cors) {
    const secret = env.SESSION_SECRET ?? '';
    if (!editingEnabled(env)) return forbidden(cors);
    const { paperId, op, blobs, deletes, message } = body;
    if (typeof paperId !== 'string') return badRequest(cors);
    const checked = checkEditorOp(op, paperId);
    if ('error' in checked) return badRequest(cors, checked.error);
    if (!Array.isArray(blobs) || blobs.length > MAX_FILES || !Array.isArray(deletes) || deletes.length > MAX_FILES) {
      return badRequest(cors);
    }
    const entries: TreeEntry[] = [];
    for (const blob of blobs as unknown[]) {
      const { path, sha, receipt } = (typeof blob === 'object' && blob !== null ? blob : {}) as Untrusted;
      if (typeof path !== 'string' || typeof sha !== 'string' || typeof receipt !== 'string' || !isPaperPath(paperId, path)) {
        return badRequest(cors, '文件位置不对');
      }
      if (!(await verifyText(receiptText(user, path, sha), receipt, secret))) return badRequest(cors);
      entries.push({ path, mode: '100644', type: 'blob', sha });
    }
    if (!deletes.every((path): path is string => typeof path === 'string' && isPaperPath(paperId, path))) {
      return badRequest(cors, '文件位置不对');
    }
    const edit: ResultsOp = { kind: 'batch', ops: [checked.op, { kind: 'noteEdit', paperId, login: user.login }] };
    const { papers } = await commitResults(api, edit, entries, deletes, commitMessage(message, user), (latest) => {
      // Checked on the very list the edit is applied to.
      if (!isEditorOf(latest, paperId, user, env)) throw new Forbidden();
    });
    return json(papersFor(papers, user, editingEnabled(env)), 200, cors);
  },
};

/** POST /results/load, /results/file, /results/upload and /results/save, with the collaborator's session. */
export async function handleResults(request: Request, pathname: string, env: ResultsEnv, cors: Headers): Promise<Response> {
  const handler = Object.prototype.hasOwnProperty.call(HANDLERS, pathname) ? HANDLERS[pathname] : undefined;
  if (!handler || !collaboratorsEnabled(env)) return json({ error: 'not_found' }, 404, cors);
  const secret = env.SESSION_SECRET ?? '';
  const user = await sessionUser(request, secret);
  if (!user) return json({ error: 'session_expired' }, 401, cors);
  const body = await readBody(request, pathname === '/results/upload' ? UPLOAD_LIMIT_BASE64 + 1024 : BODY_LIMIT);
  if (body === 'too_large') return json({ error: 'too_large' }, 413, cors);
  if (!body) return badRequest(cors);
  try {
    return await handler(await privateRepo(env), user, body, env, cors);
  } catch (error) {
    if (error instanceof Forbidden) return forbidden(cors);
    if (error instanceof ConflictError) return json({ error: 'conflict' }, 409, cors);
    if (error instanceof GitHubError && error.status === 404) return json({ error: 'not_found' }, 404, cors);
    if (error instanceof GitHubError && error.status === 401) forgetInstallationToken();
    console.error('results: request failed', error instanceof Error ? error.message : error);
    return json({ error: 'github_error' }, 502, cors);
  }
}
