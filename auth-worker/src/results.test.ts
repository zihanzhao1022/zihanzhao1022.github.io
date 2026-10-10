import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResultPaper } from '../../types';
import { forgetInstallationToken } from './github-app';
import worker, { Env } from './index';

const SITE = 'https://zihanzhao1022.github.io';
const REPO = 'https://api.github.com/repos/zihanzhao1022/homepage-private';

let env: Env;

/** A fresh RSA key in PEM, standing in for the GitHub App's private key. */
async function appKey(): Promise<string> {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: Uint8Array.of(1, 0, 1), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  return `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der))}\n-----END PRIVATE KEY-----\n`;
}

beforeAll(async () => {
  env = {
    GITHUB_CLIENT_ID: 'Iv1.test',
    GITHUB_CLIENT_SECRET: 'secret',
    OWNER_LOGIN: 'zihanzhao1022',
    ALLOWED_ORIGINS: SITE,
    PRIVATE_REPO: 'homepage-private',
    GITHUB_APP_PRIVATE_KEY: await appKey(),
    SESSION_SECRET: 'session-secret',
    // These tests cover editing as it works once switched on; see 'view-only mode' for the switch.
    COLLABORATOR_EDITING: 'true',
  };
});

const pdf = (paperId: string, blockId: string) => `results/${paperId}/${blockId}-0123abcd.pdf`;
const output = (paperId: string, blockId: string) => ({ pdf: pdf(paperId, blockId), width: 300, height: 100 });

// Made-up papers: alice may view res-a and edit res-b; bob edits res-a.
const ALICE = { login: 'alice', id: 101 };
const BOB = { login: 'bob', id: 102 };
const PAPERS: ResultPaper[] = [
  {
    id: 'res-a',
    slug: 'a',
    title: 'Made-up draft A',
    authors: ['A'],
    hidden: true,
    preamble: '\\documentclass{article}',
    files: ['style.sty'],
    viewers: ['alice'],
    editors: ['bob'],
    collaboratorIds: { alice: 101, bob: 102 },
    blocks: [
      { id: 'blk-1', kind: 'table', source: '% made-up 1', output: output('res-a', 'blk-1') },
      { id: 'blk-2', kind: 'table', source: '% made-up 2', hidden: true, output: output('res-a', 'blk-2') },
    ],
  },
  {
    id: 'res-b',
    slug: 'b',
    title: 'Made-up published B',
    authors: ['B'],
    editors: ['alice'],
    collaboratorIds: { alice: 101 },
    blocks: [{ id: 'blk-3', kind: 'text', source: 'Made-up text', output: output('res-b', 'blk-3') }],
  },
  { id: 'res-c', slug: 'c', title: 'Made-up private C', authors: [], hidden: true, blocks: [] },
];

const text = (value: string) => new TextEncoder().encode(value);

/** An in-memory GitHub: OAuth, the App's installation, and the private repository's contents and Git data. */
function fakeGitHub(user: { login: string; id: number } = ALICE) {
  let files = new Map<string, Uint8Array<ArrayBuffer>>([
    ['results.json', text(JSON.stringify(PAPERS))],
    [pdf('res-a', 'blk-1'), text('%PDF visible')],
    [pdf('res-a', 'blk-2'), text('%PDF hidden block')],
    ['results/res-a/files/style.sty', text('% style')],
    [pdf('res-b', 'blk-3'), text('%PDF b')],
    // carol may view every paper.
    ['results-access.json', text(JSON.stringify({ viewers: ['carol'], collaboratorIds: { carol: 103 } }))],
  ]);
  const blobs = new Map<string, Uint8Array<ArrayBuffer>>();
  const trees = new Map<string, Map<string, Uint8Array<ArrayBuffer>>>();
  const commits = new Map<string, { tree: string; message: string }>();
  let head = 'commit-0';
  let counter = 0;
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const route = `${method} ${url.origin}${url.pathname}`;
    if (route === 'POST https://github.com/login/oauth/access_token') return reply({ access_token: 'ghu_user' });
    if (route === 'GET https://api.github.com/user') return reply({ ...user, avatar_url: '' });
    if (route === 'DELETE https://api.github.com/applications/Iv1.test/token') return new Response(null, { status: 204 });
    if (route === `GET ${REPO}/installation`) return reply({ id: 7 });
    if (route === 'POST https://api.github.com/app/installations/7/access_tokens') {
      return reply({ token: 'ghs_installation', expires_at: new Date(Date.now() + 3600_000).toISOString() });
    }
    if (!route.includes(REPO)) throw new Error(`unexpected fetch: ${route}`);
    // Everything below is the private repository, reachable only with the installation token.
    if ((init?.headers as Record<string, string>).Authorization !== 'Bearer ghs_installation') return reply({}, 401);
    const path = url.pathname.slice(new URL(REPO).pathname.length);
    if (method === 'GET' && path.startsWith('/contents/')) {
      const file = files.get(decodeURIComponent(path.slice('/contents/'.length)));
      return file ? new Response(file) : reply({ message: 'Not Found' }, 404);
    }
    if (route === `GET ${REPO}/git/ref/heads/main`) return reply({ object: { sha: head } });
    if (method === 'GET' && path.startsWith('/git/commits/')) return reply({ tree: { sha: `tree-of-${path.slice(13)}` } });
    if (method === 'GET' && path.startsWith('/git/trees/')) {
      return reply({ truncated: false, tree: [...files.keys()].map((name) => ({ path: name, type: 'blob', sha: `sha-${name}` })) });
    }
    if (route === `POST ${REPO}/git/blobs`) {
      const sha = `blob-${(counter += 1)}`;
      blobs.set(sha, Uint8Array.from(atob(body.content), (char) => char.charCodeAt(0)));
      return reply({ sha }, 201);
    }
    if (route === `POST ${REPO}/git/trees`) {
      const next = new Map(files);
      for (const entry of body.tree as { path: string; sha?: string | null; content?: string }[]) {
        if (entry.sha === null) next.delete(entry.path);
        else if (entry.content !== undefined) next.set(entry.path, text(entry.content));
        else next.set(entry.path, blobs.get(entry.sha ?? '') ?? text('missing blob'));
      }
      const sha = `tree-${(counter += 1)}`;
      trees.set(sha, next);
      return reply({ sha }, 201);
    }
    if (route === `POST ${REPO}/git/commits`) {
      const sha = `commit-${(counter += 1)}`;
      commits.set(sha, { tree: body.tree, message: body.message });
      return reply({ sha }, 201);
    }
    if (route === `PATCH ${REPO}/git/refs/heads/main`) {
      head = body.sha;
      files = trees.get(commits.get(body.sha)!.tree)!;
      return reply({});
    }
    throw new Error(`unexpected fetch: ${route}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return {
    fetchMock,
    papers: () => JSON.parse(new TextDecoder().decode(files.get('results.json'))) as ResultPaper[],
    file: (name: string) => files.get(name),
    lastCommit: () => [...commits.values()].pop(),
  };
}

const request = (path: string, body: unknown, session?: string) =>
  worker.fetch(
    new Request(`https://auth.example${path}`, {
      method: 'POST',
      headers: { Origin: SITE, 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session}` } : {}) },
      body: JSON.stringify(body),
    }),
    env,
  );

const login = { code: 'the-code', code_verifier: 'the-verifier', redirect_uri: `${SITE}/` };

/** Signs a collaborator in through the worker and returns their session. */
async function signIn(user = ALICE): Promise<string> {
  fakeGitHub(user);
  const res = await request('/token', login);
  expect(res.status).toBe(200);
  return ((await res.json()) as { session: string }).session;
}

beforeEach(() => forgetInstallationToken());
afterEach(() => vi.unstubAllGlobals());

describe('collaborator login', () => {
  it('gives listed people a session of the worker instead of their GitHub token', async () => {
    const github = fakeGitHub(ALICE);
    const res = await request('/token', login);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ role: 'collaborator', login: 'alice' });
    expect(body).not.toHaveProperty('access_token');
    expect(JSON.stringify(body)).not.toContain('ghu_user');
    expect(github.fetchMock.mock.calls.some(([url, init]) => String(url).includes('/applications/') && init?.method === 'DELETE')).toBe(true);
  });

  it('refuses people on no list, and accounts that took a listed name', async () => {
    fakeGitHub({ login: 'dave', id: 104 });
    expect((await request('/token', login)).status).toBe(403);
    forgetInstallationToken();
    fakeGitHub({ login: 'alice', id: 999 });
    expect((await request('/token', login)).status).toBe(403);
  });

  it('keeps the old owner-only behaviour until the App key and session secret are set', async () => {
    fakeGitHub(ALICE);
    const res = await worker.fetch(
      new Request('https://auth.example/token', { method: 'POST', headers: { Origin: SITE }, body: JSON.stringify(login) }),
      { ...env, GITHUB_APP_PRIVATE_KEY: undefined },
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'not_owner' });
  });

  it('lets the site send the session header', async () => {
    const res = await worker.fetch(new Request('https://auth.example/results/load', { method: 'OPTIONS', headers: { Origin: SITE } }), env);
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
  });
});

describe('reading', () => {
  it('needs a valid session', async () => {
    fakeGitHub();
    expect((await request('/results/load', {})).status).toBe(401);
    expect((await request('/results/load', {}, 'forged.session')).status).toBe(401);
  });

  it('shows each person only their papers, in their role', async () => {
    const session = await signIn(ALICE);
    const res = await request('/results/load', {}, session);
    const shared = (await res.json()) as { papers: ResultPaper[]; roles: Record<string, string> };
    expect(shared.roles).toEqual({ 'res-a': 'viewer', 'res-b': 'editor' });
    const [viewed, edited] = shared.papers;
    expect(viewed.blocks).toEqual([{ id: 'blk-1', kind: 'table', output: output('res-a', 'blk-1') }]);
    expect(edited.blocks[0].source).toBe('Made-up text');
    expect(JSON.stringify(shared)).not.toMatch(/viewers|editors|collaboratorIds|Made-up private C|made-up 2/);
  });

  it('lets viewers read only the PDFs of visible blocks, and editors the files of their paper', async () => {
    const alice = await signIn(ALICE);
    const visible = await request('/results/file', { path: pdf('res-a', 'blk-1') }, alice);
    expect(visible.status).toBe(200);
    expect(new TextDecoder().decode(await visible.arrayBuffer())).toBe('%PDF visible');
    expect((await request('/results/file', { path: pdf('res-a', 'blk-2') }, alice)).status).toBe(403);
    expect((await request('/results/file', { path: 'results/res-a/files/style.sty' }, alice)).status).toBe(403);
    expect((await request('/results/file', { path: 'results/res-c/x.pdf' }, alice)).status).toBe(403);
    expect((await request('/results/file', { path: 'results/res-a/../res-c/x.pdf' }, alice)).status).toBe(400);
    expect((await request('/results/file', { path: 'results.json' }, alice)).status).toBe(400);
    forgetInstallationToken();
    const bob = await signIn(BOB);
    expect((await request('/results/file', { path: 'results/res-a/files/style.sty' }, bob)).status).toBe(200);
  });

  it('asks for the installation token once and reuses it', async () => {
    const session = await signIn(ALICE);
    const github = fakeGitHub(ALICE);
    await request('/results/load', {}, session);
    await request('/results/load', {}, session);
    expect(github.fetchMock.mock.calls.filter(([url]) => String(url).includes('/access_tokens'))).toHaveLength(0);
  });

  it('turns people away once they are no longer on any list', async () => {
    const session = await signIn({ login: 'bob', id: 102 });
    const github = fakeGitHub(BOB);
    github.fetchMock.mockClear();
    // The owner removed bob meanwhile: the worker reads the latest list on every request.
    const removed = PAPERS.map((paper) => ({ ...paper, editors: [] }));
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes('/contents/results.json') ? new Response(JSON.stringify(removed)) : github.fetchMock(input, init),
    );
    expect((await request('/results/load', {}, session)).status).toBe(403);
  });
});

describe('the results-wide list', () => {
  it('lets its people sign in and view every paper, read-only', async () => {
    const carol = await signIn({ login: 'carol', id: 103 });
    fakeGitHub({ login: 'carol', id: 103 });
    const shared = (await (await request('/results/load', {}, carol)).json()) as { papers: ResultPaper[]; roles: Record<string, string> };
    expect(shared.roles).toEqual({ 'res-a': 'viewer', 'res-b': 'viewer', 'res-c': 'viewer' });
    expect(JSON.stringify(shared)).not.toMatch(/made-up 1|Made-up text/);
    expect((await request('/results/file', { path: pdf('res-b', 'blk-3') }, carol)).status).toBe(200);
    expect((await request('/results/file', { path: 'results/res-a/files/style.sty' }, carol)).status).toBe(403);
  });
});

describe('view-only mode', () => {
  it('lets editors only view while editing is switched off', async () => {
    const session = await signIn(ALICE);
    const github = fakeGitHub(ALICE);
    const viewOnly = { ...env, COLLABORATOR_EDITING: 'false' };
    const call = (path: string, body: unknown) =>
      worker.fetch(
        new Request(`https://auth.example${path}`, {
          method: 'POST',
          headers: { Origin: SITE, 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
          body: JSON.stringify(body),
        }),
        viewOnly,
      );
    const shared = (await (await call('/results/load', {})).json()) as { papers: ResultPaper[]; roles: Record<string, string> };
    expect(shared.roles).toEqual({ 'res-a': 'viewer', 'res-b': 'viewer' });
    expect(JSON.stringify(shared)).not.toContain('Made-up text');
    expect((await call('/results/file', { path: pdf('res-b', 'blk-3') })).status).toBe(200);
    expect((await call('/results/upload', { paperId: 'res-b', path: 'results/res-b/x.pdf', base64: 'AAAA' })).status).toBe(403);
    const op = { kind: 'putBlock', paperId: 'res-b', block: { id: 'blk-3', kind: 'text', source: 'x' } };
    expect((await call('/results/save', { paperId: 'res-b', op, blobs: [], deletes: [] })).status).toBe(403);
    expect(github.lastCommit()).toBeUndefined();
  });
});

describe('editing', () => {
  const putBlock = { kind: 'putBlock', paperId: 'res-b', block: { id: 'blk-3', kind: 'text', source: 'Made-up edit' } };

  it("commits an editor's edit to the private repository, marked for the owner's review", async () => {
    const session = await signIn(ALICE);
    const github = fakeGitHub(ALICE);
    const upload = await request('/results/upload', { paperId: 'res-b', path: 'results/res-b/blk-3-4567cdef.pdf', base64: btoa('%PDF new') }, session);
    expect(upload.status).toBe(200);
    const blob = (await upload.json()) as { path: string; sha: string; receipt: string };
    const op = {
      kind: 'batch',
      ops: [
        putBlock,
        {
          kind: 'setOutputs',
          paperId: 'res-b',
          outputs: { 'blk-3': { pdf: 'results/res-b/blk-3-4567cdef.pdf', width: 200, height: 50 } },
          sources: { 'blk-3': 'Made-up edit' },
        },
      ],
    };
    const res = await request(
      '/results/save',
      { paperId: 'res-b', op, blobs: [blob], deletes: [pdf('res-b', 'blk-3')], message: 'results: update block in "B"' },
      session,
    );
    expect(res.status).toBe(200);
    const saved = github.papers().find((paper) => paper.id === 'res-b')!;
    expect(saved.blocks[0]).toMatchObject({ source: 'Made-up edit', output: { pdf: 'results/res-b/blk-3-4567cdef.pdf' } });
    // Published paper: the edit waits for the owner before the site shows it.
    expect(saved.pendingReview).toEqual(['alice']);
    expect(saved.editors).toEqual(['alice']);
    expect(new TextDecoder().decode(github.file('results/res-b/blk-3-4567cdef.pdf'))).toBe('%PDF new');
    expect(github.file(pdf('res-b', 'blk-3'))).toBeUndefined();
    expect(github.lastCommit()?.message).toBe('results: update block in "B" (by alice)');
    const shared = (await res.json()) as { papers: ResultPaper[] };
    expect(JSON.stringify(shared)).not.toMatch(/pendingReview|collaboratorIds|editors/);
  });

  it('refuses viewers, other papers and what only the owner may do', async () => {
    const session = await signIn(ALICE);
    const github = fakeGitHub(ALICE);
    const save = (paperId: string, op: unknown) => request('/results/save', { paperId, op, blobs: [], deletes: [] }, session);
    expect((await save('res-a', { kind: 'deleteBlock', paperId: 'res-a', blockId: 'blk-1' })).status).toBe(403);
    expect((await save('res-b', { kind: 'deleteBlock', paperId: 'res-a', blockId: 'blk-1' })).status).toBe(400);
    expect((await save('res-b', { kind: 'setPaperHidden', id: 'res-b', hidden: true })).status).toBe(400);
    expect((await save('res-b', { kind: 'approveEdits', id: 'res-b' })).status).toBe(400);
    expect((await save('res-b', { kind: 'putPaper', paper: { ...PAPERS[1], editors: ['mallory'] } })).status).toBe(400);
    expect((await save('res-c', { kind: 'deleteBlock', paperId: 'res-c', blockId: 'blk-1' })).status).toBe(403);
    expect(github.lastCommit()).toBeUndefined();
  });

  it('only commits files the worker received from this person for this paper', async () => {
    const alice = await signIn(ALICE);
    const github = fakeGitHub(ALICE);
    const upload = await request('/results/upload', { paperId: 'res-b', path: 'results/res-b/x.pdf', base64: btoa('x') }, alice);
    const blob = (await upload.json()) as { path: string; sha: string; receipt: string };
    const save = (blobs: unknown[], deletes: string[] = [], session = alice) =>
      request('/results/save', { paperId: 'res-b', op: putBlock, blobs, deletes }, session);
    expect((await save([{ ...blob, sha: 'blob-of-something-else' }])).status).toBe(400);
    expect((await save([{ ...blob, path: 'results/res-b/y.pdf' }])).status).toBe(400);
    expect((await save([{ ...blob, receipt: 'forged' }])).status).toBe(400);
    expect((await save([], ['results/res-a/files/style.sty'])).status).toBe(400);
    expect((await save([], ['results.json'])).status).toBe(400);
    expect(github.lastCommit()).toBeUndefined();
    expect((await save([blob])).status).toBe(200);
  });

  it('checks uploads: editors only, inside the paper, base64, at most 1 MB', async () => {
    const session = await signIn(ALICE);
    fakeGitHub(ALICE);
    const upload = (body: Record<string, unknown>) => request('/results/upload', { paperId: 'res-b', path: 'results/res-b/x.pdf', base64: 'AAAA', ...body }, session);
    expect((await upload({ paperId: 'res-a', path: 'results/res-a/x.pdf' })).status).toBe(403);
    expect((await upload({ path: 'results/res-a/x.pdf' })).status).toBe(400);
    expect((await upload({ path: 'public/results/res-b/x.pdf' })).status).toBe(400);
    expect((await upload({ base64: 'not base64!' })).status).toBe(400);
    expect((await upload({ base64: 'A'.repeat(1_500_000) })).status).toBe(413);
  });
});
