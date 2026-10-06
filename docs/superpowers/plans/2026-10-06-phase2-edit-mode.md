# 第二、三阶段：登录与编辑模式 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在线上网站加入"用 GitHub 登录 + 领英式编辑模式"：所有者登录后在页面上直接增删改内容和图片，每次保存立即提交到仓库并自动部署。

**Architecture:**
- **登录：** 网页把 GitHub 授权码交给 Cloudflare Worker 换取令牌（Task 1，已完成），令牌存在 localStorage。
- **加载与访问控制：** 编辑器代码按需加载，访客不会下载。登录后先从 GitHub 读取最新内容，页面里的编辑按钮才会出现。
- **保存：** 每次保存把操作应用到 GitHub 上的最新 JSON，再和图片合成一次提交。
- **本地验证：** 用模拟后端在本地完整验证界面，不需要真实账号。

**Tech Stack:** React 18 · TypeScript 5.9 · Tailwind CSS 3.4 · Vitest 3.2 · GitHub REST API（Git Data / Contents / Actions）· Cloudflare Workers（wrangler 4）

**规格：** `docs/superpowers/specs/2026-10-06-inline-edit-mode-design.md`（第 11 节第 2、3 项）

## Global Constraints

- **对访客不可见：**
  - 页面快照测试（`views/__snapshots__/`）必须保持不变；
  - 编辑按钮在非编辑模式下一律渲染为空；
  - 主包不能包含编辑器代码和模拟后端。
- **界面语言：** 编辑界面用中文，网站本身的英文内容不变。
- **GitHub 仓库：** `zihanzhao1022/zihanzhao1022.github.io`，分支 `main`。GitHub App Client ID：`Iv23liGqrkAjs9Kn7RKo`。
- **令牌：**
  - 令牌只存在 localStorage，键名 `homepage-editor-session`；
  - 打开编辑弹窗前，如果剩余有效期不足 15 分钟，提示重新登录。
- **图片：**
  - 支持 PNG、JPEG、WebP、GIF，单张不超过 5MB；长边超过 1600px 时自动缩小，GIF 不缩放；
  - 存放路径为 `public/images/uploads/<YYYYMMDD-HHmmss>-<slug>.<ext>`（UTC 时间）。
- **内容数据：**
  - 新条目插入列表开头，id 格式为 `<前缀>-<base36 时间戳>`；
  - 保存时 JSON 使用 2 空格缩进，末尾带换行。
- **提交：**
  - 内容提交信息格式为 `content: <add|update|delete|reorder> <对象> "<标题>"`；
  - 代码提交信息用英文，结尾带 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## 执行说明

带 `file=路径` 标注的代码块是**新文件的完整内容**。为避免手抄，可以用 scratchpad 里的提取脚本把某个任务的新文件一次写出：

```bash
node <SCRATCH>/extract-plan.mjs docs/superpowers/plans/2026-10-06-phase2-edit-mode.md <任务编号>
```

修改已有文件时，计划给出"把 A 替换为 B"的片段，用编辑工具逐处修改。

---

## 文件结构

| 路径 | 职责 | 进入哪个包 |
|---|---|---|
| `auth-worker/` | 用授权码换令牌、校验本人、吊销（Task 1，已完成） | Cloudflare |
| `types.ts` | 新增 `ListCollection`、`ProfileSection`、`EditRequest` | 共用 |
| `lib/session.ts` | 会话读写、过期判断、登录回调解析、回跳路由校验 | 主包 |
| `lib/localImages.ts` | 新上传图片的本地预览映射 `resolveImage()` | 主包 |
| `editor/config.ts` | owner、repo、branch、clientId、workerUrl | 主包（体积很小） |
| `editor/auth.ts` | PKCE、跳转 GitHub、完成登录、退出 | 编辑器（按需加载） |
| `editor/ops.ts` | 内容操作（纯函数）和提交信息 | 编辑器 |
| `editor/github.ts` | GitHub REST 客户端 | 编辑器 |
| `editor/backend.ts` | `EditorBackend` 接口、GitHub 实现、错误描述 | 编辑器 |
| `editor/mockBackend.ts` | 内存模拟后端 | 仅开发模式 |
| `editor/images.ts` | 图片校验、缩放、命名 | 编辑器 |
| `editor/schemas.ts` | 各表单字段声明、校验、表单与数据的互转 | 编辑器 |
| `editor/components/*` | `Modal`、字段组件、`ItemModal`、`ReorderModal`、`AdminBar` | 编辑器 |
| `editor/EditorRoot.tsx` | 编辑模式根组件：加载、保存、部署状态、弹窗调度 | 编辑器 |
| `components/ContentContext.tsx` | 增加 `ContentProvider` 和 `useUpdateContent()` | 主包 |
| `components/EditMode.tsx` | 编辑模式上下文、`EditModeProvider`、编辑按钮、`Toast` | 主包 |
| `components/ListItem.tsx`、`components/Footer.tsx`、`App.tsx`、`index.tsx`、`views/*.tsx` | 接入编辑按钮、登录入口、回调处理 | 主包 |
| `vite-env.d.ts`、`.env.mock`、`package.json` | `import.meta.env` 类型、模拟模式开关、`dev:mock` 脚本 | — |
| `docs/admin-setup.md`、`README.md` | 一次性配置说明、编辑模式说明 | — |

---

### Task 1：Cloudflare Worker（已完成，提交 745a18f）

- `auth-worker/src/index.ts`：`POST /token`（校验 `redirect_uri`，用 client secret 和 PKCE verifier 换令牌，不是 `OWNER_LOGIN` 时吊销并返回 403）；`POST /revoke`；CORS 只允许 `ALLOWED_ORIGINS`。
- `auth-worker/src/index.test.ts`：8 个测试通过。
- `auth-worker/wrangler.toml`：`GITHUB_CLIENT_ID = "Iv23liGqrkAjs9Kn7RKo"`、`OWNER_LOGIN = "zihanzhao1022"`、`ALLOWED_ORIGINS = "https://zihanzhao1022.github.io,http://localhost:3000"`。
- `wrangler deploy --dry-run` 打包成功（3.90 KiB）。

---

### Task 2：共用类型、会话与配置

**Files:**
- Modify: `types.ts`（末尾追加）
- Create: `vite-env.d.ts`、`.env.mock`、`lib/session.ts`、`editor/config.ts`
- Modify: `package.json`（加 `dev:mock` 脚本）
- Test: `lib/session.test.ts`

**Interfaces:**
- Produces（`types.ts`）：`ListCollection`、`ProfileSection`、`EditRequest`（见下方代码）。
- Produces（`lib/session.ts`）：
  - 类型：`Session { token; login; avatarUrl; expiresAt }`、`PendingLogin { state; verifier; returnHash }`、`LoginCallback { code; state; error }`、`StorageLike`。
  - 常量：`MOCK_MODE: boolean`。
  - 会话读写：`loadSession(storage?, now?)`、`saveSession(value, storage?)`、`clearSession(storage?)`、`isExpiringSoon(value, now?)`。
  - 登录往返：`safeReturnHash(hash)`、`savePendingLogin`、`readPendingLogin`、`clearPendingLogin`、`takeLoginCallback(): LoginCallback | null`。
- Produces（`editor/config.ts`）：`EDITOR_CONFIG { owner; repo; branch; clientId; workerUrl }`、`loginConfigured(): boolean`。

- [ ] **Step 1：在 `types.ts` 末尾追加**

```ts
export type ListCollection = 'news' | 'experiences' | 'publications' | 'projects' | 'talks' | 'awards';

export type ProfileSection = 'basics' | 'bio' | 'avatar' | 'socials';

/** What an edit button asks the edit mode to open. */
export type EditRequest =
  | { kind: 'edit'; collection: ListCollection; id: string }
  | { kind: 'add'; collection: ListCollection; preset?: Record<string, unknown> }
  | { kind: 'reorder'; collection: ListCollection; category?: ExperienceCategory }
  | { kind: 'profile'; section: ProfileSection };
```

- [ ] **Step 2：创建 `vite-env.d.ts` 和 `.env.mock`**

```ts file=vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" only under `npm run dev:mock` (see .env.mock). */
  readonly VITE_EDITOR_MOCK?: string;
}
```

```bash file=.env.mock
# Loaded by `npm run dev:mock`: fake login and an in-memory GitHub, for local testing only.
VITE_EDITOR_MOCK=true
```

在 `package.json` 的 `scripts` 里，把

```json
    "dev": "vite",
```

替换为

```json
    "dev": "vite",
    "dev:mock": "vite --mode mock",
```

- [ ] **Step 3：编写失败的测试**

```ts file=lib/session.test.ts
import { describe, expect, it } from 'vitest';
import { StorageLike, isExpiringSoon, loadSession, safeReturnHash, saveSession } from './session';

const memoryStorage = () => {
  const data = new Map<string, string>();
  const storage: StorageLike = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
  return { data, storage };
};

const session = { token: 'ghu_x', login: 'zihanzhao1022', avatarUrl: 'https://avatars.example/x', expiresAt: 10_000 };

describe('session storage', () => {
  it('round-trips a valid session', () => {
    const { storage } = memoryStorage();
    saveSession(session, storage);
    expect(loadSession(storage, 5_000)).toEqual(session);
  });

  it('drops expired sessions', () => {
    const { data, storage } = memoryStorage();
    saveSession(session, storage);
    expect(loadSession(storage, 10_000)).toBeNull();
    expect(data.size).toBe(0);
  });

  it('ignores malformed data', () => {
    const { storage } = memoryStorage();
    storage.setItem('homepage-editor-session', '{not json');
    expect(loadSession(storage, 0)).toBeNull();
    storage.setItem('homepage-editor-session', JSON.stringify({ token: 1 }));
    expect(loadSession(storage, 0)).toBeNull();
  });

  it('survives storage that throws', () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    const broken: StorageLike = { getItem: blocked, setItem: blocked, removeItem: blocked };
    expect(() => saveSession(session, broken)).not.toThrow();
    expect(loadSession(broken, 0)).toBeNull();
  });
});

describe('isExpiringSoon', () => {
  it('warns within 15 minutes of expiry', () => {
    expect(isExpiringSoon({ ...session, expiresAt: 20 * 60_000 }, 0)).toBe(false);
    expect(isExpiringSoon({ ...session, expiresAt: 14 * 60_000 }, 0)).toBe(true);
  });
});

describe('safeReturnHash', () => {
  it('keeps internal routes', () => {
    expect(safeReturnHash('#/publications')).toBe('#/publications');
    expect(safeReturnHash('#/')).toBe('#/');
  });

  it('falls back to the home page for anything else', () => {
    expect(safeReturnHash('')).toBe('#/');
    expect(safeReturnHash(undefined)).toBe('#/');
    expect(safeReturnHash('#//evil.example')).toBe('#/');
    expect(safeReturnHash('#/x"><script>')).toBe('#/');
    expect(safeReturnHash('https://evil.example')).toBe('#/');
  });
});
```

Run: `npx vitest run lib/session.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 4：实现 `lib/session.ts`**

```ts file=lib/session.ts
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
```

- [ ] **Step 5：创建 `editor/config.ts`**

```ts file=editor/config.ts
/**
 * Public identifiers for the edit mode. The GitHub App's client secret lives only in the
 * Cloudflare Worker (see auth-worker/), never in this repository.
 */
export const EDITOR_CONFIG = {
  owner: 'zihanzhao1022',
  repo: 'zihanzhao1022.github.io',
  branch: 'main',
  /** GitHub App client ID. */
  clientId: 'Iv23liGqrkAjs9Kn7RKo',
  /** Cloudflare Worker URL without a trailing slash, e.g. https://homepage-auth.<subdomain>.workers.dev */
  workerUrl: '',
};

/** The login entry stays hidden until both values are filled in. */
export const loginConfigured = (): boolean => EDITOR_CONFIG.clientId !== '' && EDITOR_CONFIG.workerUrl !== '';
```

- [ ] **Step 6：运行测试与类型检查**

Run: `npx vitest run lib/session.test.ts && npx tsc`
Expected: `7 passed`；`tsc` 无输出。

- [ ] **Step 7：提交**

```bash
git add types.ts vite-env.d.ts .env.mock package.json lib/session.ts lib/session.test.ts editor/config.ts
git commit -m "feat: add editor session storage, shared edit types and config

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3：登录流程

**Files:**
- Create: `editor/auth.ts`
- Test: `editor/auth.test.ts`

**Interfaces:**
- Consumes：`lib/session.ts` 全部导出；`EDITOR_CONFIG`。
- Produces：
  - 错误类型：`class LoginError extends Error`。
  - PKCE 与授权：`randomToken(): string`、`pkceChallenge(verifier): Promise<string>`、`buildAuthorizeUrl({ clientId, redirectUri, state, challenge }): string`。
  - 回调与换令牌：`checkCallback(callback, pending): { code; verifier }`、`exchangeCode(code, verifier, redirect, fetchImpl?): Promise<Session>`。
  - 登录入口：`startLogin(): Promise<Session | null>`（模拟模式返回会话，真实模式跳转后返回 null）、`completeLogin(callback): Promise<Session>`、`logout(session): Promise<void>`。

- [ ] **Step 1：编写失败的测试**

```ts file=editor/auth.test.ts
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

  it('explains a refused account', async () => {
    await expect(exchangeCode('c', 'v', 'r', reply(403, { error: 'not_owner' }))).rejects.toThrow('该账号没有编辑权限');
  });

  it('explains other failures', async () => {
    await expect(exchangeCode('c', 'v', 'r', reply(400, { error: 'bad_verification_code' }))).rejects.toThrow('登录失败');
    const offline = vi.fn(async () => {
      throw new TypeError('offline');
    });
    await expect(exchangeCode('c', 'v', 'r', offline)).rejects.toThrow('无法连接登录服务');
  });
});
```

Run: `npx vitest run editor/auth.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 2：实现 `editor/auth.ts`**

```ts file=editor/auth.ts
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
```

- [ ] **Step 3：运行测试，确认通过**

Run: `npx vitest run editor/auth.test.ts && npx tsc`
Expected: `8 passed`；`tsc` 无输出。

- [ ] **Step 4：提交**

```bash
git add editor/auth.ts editor/auth.test.ts
git commit -m "feat: add GitHub login flow with PKCE for the edit mode

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4：内容操作

**Files:**
- Create: `editor/ops.ts`
- Test: `editor/ops.test.ts`

**Interfaces:**
- Consumes：`SiteContent`、`ListCollection`、`Profile`（`types.ts`）。
- Produces：
  - 类型：`ListItem`、`ContentOp`、`ListOp`。
  - 应用操作：`applyListOp<T>(list, op): T[]`、`applyOp(content, op): SiteContent`。
  - 提交信息：`itemNoun(collection): string`、`commitMessage(action, target, label?): string`。

- [ ] **Step 1：编写失败的测试**

```ts file=editor/ops.test.ts
import { describe, expect, it } from 'vitest';
import { applyListOp, applyOp, commitMessage } from './ops';
import { SiteContent } from '../types';
import fixture from '../views/__fixtures__/content.json';

const content = fixture as SiteContent;

const list = [
  { id: 'a', category: 'work' },
  { id: 'b', category: 'education' },
  { id: 'c', category: 'work' },
  { id: 'd', category: 'work' },
];
const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe('applyListOp', () => {
  it('replaces an existing item in place', () => {
    const next = applyListOp(list, { kind: 'upsert', collection: 'experiences', item: { id: 'c', category: 'volunteer' } });
    expect(next.map((item) => `${item.id}:${item.category}`)).toEqual(['a:work', 'b:education', 'c:volunteer', 'd:work']);
  });

  it('puts new items first', () => {
    expect(ids(applyListOp(list, { kind: 'upsert', collection: 'experiences', item: { id: 'new' } }))).toEqual([
      'new',
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('deletes by id', () => {
    expect(ids(applyListOp(list, { kind: 'delete', collection: 'experiences', id: 'c' }))).toEqual(['a', 'b', 'd']);
  });

  it('reorders only the listed items and leaves the others in place', () => {
    expect(ids(applyListOp(list, { kind: 'reorder', collection: 'experiences', ids: ['d', 'a', 'c'] }))).toEqual([
      'd',
      'b',
      'a',
      'c',
    ]);
  });

  it('ignores unknown and repeated ids when reordering', () => {
    expect(ids(applyListOp(list, { kind: 'reorder', collection: 'experiences', ids: ['zzz', 'c', 'c', 'a'] }))).toEqual([
      'c',
      'b',
      'a',
      'd',
    ]);
  });

  it('does not change the input list', () => {
    const before = structuredClone(list);
    applyListOp(list, { kind: 'delete', collection: 'experiences', id: 'a' });
    expect(list).toEqual(before);
  });
});

describe('applyOp', () => {
  it('patches only the given profile fields', () => {
    const next = applyOp(content, { kind: 'patchProfile', collection: 'profile', fields: { title: 'Researcher' } });
    expect(next.profile.title).toBe('Researcher');
    expect(next.profile.bio).toEqual(content.profile.bio);
    expect(next.news).toBe(content.news);
  });

  it('changes one collection and leaves the others untouched', () => {
    const next = applyOp(content, { kind: 'delete', collection: 'talks', id: 't1' });
    expect(ids(next.talks)).toEqual(['t2', 't3', 't4']);
    expect(next.publications).toBe(content.publications);
  });
});

describe('commitMessage', () => {
  it('formats item, list and profile messages', () => {
    expect(commitMessage('update', 'publication', 'Federated Large Domain Model System')).toBe(
      'content: update publication "Federated Large Domain Model System"',
    );
    expect(commitMessage('reorder', 'experiences')).toBe('content: reorder experiences');
    expect(commitMessage('update', 'profile bio')).toBe('content: update profile bio');
  });

  it('flattens whitespace and shortens long labels', () => {
    expect(commitMessage('add', 'news item', 'line one\n  line two')).toBe('content: add news item "line one line two"');
    expect(commitMessage('add', 'talk', 'x'.repeat(80))).toBe(`content: add talk "${'x'.repeat(57)}..."`);
  });
});
```

Run: `npx vitest run editor/ops.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 2：实现 `editor/ops.ts`**

```ts file=editor/ops.ts
import { ListCollection, Profile, SiteContent } from '../types';

export type ListItem = { id: string } & Record<string, unknown>;

export type ContentOp =
  | { kind: 'upsert'; collection: ListCollection; item: ListItem }
  | { kind: 'delete'; collection: ListCollection; id: string }
  | { kind: 'reorder'; collection: ListCollection; ids: string[] }
  | { kind: 'patchProfile'; collection: 'profile'; fields: Partial<Profile> };

export type ListOp = Exclude<ContentOp, { kind: 'patchProfile' }>;

/** Applies one edit to a list. New items go first; reordering only moves the listed items. */
export function applyListOp<T extends { id: string }>(list: T[], op: ListOp): T[] {
  switch (op.kind) {
    case 'upsert': {
      const item = op.item as unknown as T;
      const index = list.findIndex((entry) => entry.id === item.id);
      return index === -1 ? [item, ...list] : list.map((entry, i) => (i === index ? item : entry));
    }
    case 'delete':
      return list.filter((entry) => entry.id !== op.id);
    case 'reorder': {
      const wanted = [...new Set(op.ids)].filter((id) => list.some((entry) => entry.id === id));
      const slots = list.flatMap((entry, i) => (wanted.includes(entry.id) ? [i] : []));
      const byId = new Map(list.map((entry) => [entry.id, entry]));
      const next = [...list];
      slots.forEach((slot, k) => {
        next[slot] = byId.get(wanted[k]) as T;
      });
      return next;
    }
  }
}

export function applyOp(content: SiteContent, op: ContentOp): SiteContent {
  if (op.kind === 'patchProfile') return { ...content, profile: { ...content.profile, ...op.fields } };
  const list = content[op.collection] as unknown as { id: string }[];
  return { ...content, [op.collection]: applyListOp(list, op) } as SiteContent;
}

const NOUNS: Record<ListCollection, string> = {
  news: 'news item',
  experiences: 'experience',
  publications: 'publication',
  projects: 'project',
  talks: 'talk',
  awards: 'award',
};

export const itemNoun = (collection: ListCollection): string => NOUNS[collection];

/** e.g. content: update publication "Federated Large Domain Model System" */
export function commitMessage(action: 'add' | 'update' | 'delete' | 'reorder', target: string, label?: string): string {
  const text = label?.replace(/\s+/g, ' ').trim();
  const short = text && text.length > 60 ? `${text.slice(0, 57)}...` : text;
  return `content: ${action} ${target}${short ? ` "${short}"` : ''}`;
}
```

- [ ] **Step 3：运行测试，确认通过**

Run: `npx vitest run editor/ops.test.ts && npx tsc`
Expected: `10 passed`；`tsc` 无输出。

- [ ] **Step 4：提交**

```bash
git add editor/ops.ts editor/ops.test.ts
git commit -m "feat: add content operations for the edit mode

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5：GitHub 客户端与保存后端

**Files:**
- Create: `editor/github.ts`、`editor/backend.ts`、`editor/mockBackend.ts`
- Test: `editor/github.test.ts`、`editor/backend.test.ts`

**Interfaces:**
- Consumes：`applyOp`、`ContentOp`（Task 4）；`EDITOR_CONFIG`、`Session`（Task 2）；`bundledContent`。
- Produces（`github.ts`）：
  - 错误与类型：`class GitHubError { status: number }`、`RepoRef`、`TreeEntry`、`WorkflowRun`。
  - 客户端接口：`GitHubApi { headSha; treeSha; readText; createBlob; createTree; createCommit; updateBranch; latestRun }`。
  - 工具函数：`decodeBase64Utf8(base64)`、`createGitHubApi(token, repo, fetchImpl?)`。
- Produces（`backend.ts`）：
  - 类型：`ImageUpload { path; base64; previewUrl }`、`DeployState`、`DeployStatus`、`SaveResult`。
  - 后端接口：`EditorBackend { load(); save(op, uploads, message, current); deployStatus(sha) }`。
  - 错误：`ConflictError`、`describeSaveError(error): string`。
  - 创建与工具：`contentPath(collection)`、`createGitHubBackend(api)`、`createBackend(session): Promise<EditorBackend>`。
- Produces（`mockBackend.ts`）：`createMockBackend(): EditorBackend`。

- [ ] **Step 1：编写失败的测试**

```ts file=editor/github.test.ts
import { describe, expect, it, vi } from 'vitest';
import { GitHubError, createGitHubApi, decodeBase64Utf8 } from './github';

const repo = { owner: 'zihanzhao1022', repo: 'zihanzhao1022.github.io', branch: 'main' };
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe('decodeBase64Utf8', () => {
  it('decodes UTF-8 text with line breaks, as the contents API returns it', () => {
    const text = '子涵 赵 – Bachelor’s 🚀';
    const base64 = btoa(String.fromCharCode(...new TextEncoder().encode(text)));
    expect(decodeBase64Utf8(`${base64.slice(0, 10)}\n${base64.slice(10)}`)).toBe(text);
  });
});

describe('createGitHubApi', () => {
  it('authenticates every request and bypasses the HTTP cache', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ok({ object: { sha: 'abc' } }));
    const api = createGitHubApi('ghu_token', repo, fetchMock);
    expect(await api.headSha()).toBe('abc');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/zihanzhao1022/zihanzhao1022.github.io/git/ref/heads/main');
    expect(init?.cache).toBe('no-store');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer ghu_token');
  });

  it('only fast-forwards the branch', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ok({}));
    await createGitHubApi('t', repo, fetchMock).updateBranch('def');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/git\/refs\/heads\/main$/);
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({ sha: 'def', force: false });
  });

  it('reports the HTTP status of failures', async () => {
    const api = createGitHubApi('t', repo, vi.fn(async () => new Response('{}', { status: 422 })));
    await expect(api.updateBranch('x')).rejects.toMatchObject({ status: 422 });
  });

  it('reports network failures as status 0', async () => {
    const offline = vi.fn(async () => {
      throw new TypeError('offline');
    });
    const api = createGitHubApi('t', repo, offline);
    await expect(api.headSha()).rejects.toBeInstanceOf(GitHubError);
    await expect(api.headSha()).rejects.toMatchObject({ status: 0 });
  });
});
```

```ts file=editor/backend.test.ts
import { describe, expect, it, vi } from 'vitest';
import { ConflictError, contentPath, createGitHubBackend, describeSaveError } from './backend';
import { GitHubApi, GitHubError, TreeEntry, WorkflowRun } from './github';
import { SiteContent } from '../types';
import fixture from '../views/__fixtures__/content.json';

const current = fixture as SiteContent;
const image = { path: 'public/images/uploads/x.png', base64: 'AAAA', previewUrl: 'blob:x' };

/** A fake GitHub whose files are the fixture, except for any overrides. */
function fakeApi(overrides: Partial<Record<keyof SiteContent, unknown>> = {}) {
  const files: Record<string, string> = {};
  for (const key of Object.keys(current) as (keyof SiteContent)[]) {
    files[contentPath(key)] = JSON.stringify(overrides[key] ?? current[key]);
  }
  return {
    headSha: vi.fn(async () => 'head1'),
    treeSha: vi.fn(async (_commit: string) => 'tree1'),
    readText: vi.fn(async (path: string, _ref: string) => files[path]),
    createBlob: vi.fn(async (_base64: string) => 'blob1'),
    createTree: vi.fn(async (_base: string, _entries: TreeEntry[]) => 'tree2'),
    createCommit: vi.fn(async (_message: string, _tree: string, _parent: string) => 'commit1'),
    updateBranch: vi.fn(async (_sha: string) => {}),
    latestRun: vi.fn(async (_sha: string): Promise<WorkflowRun | null> => null),
  } satisfies GitHubApi;
}

describe('GitHub backend', () => {
  it('loads every content file from the latest commit', async () => {
    const api = fakeApi();
    expect(await createGitHubBackend(api).load()).toEqual(current);
    expect(api.readText).toHaveBeenCalledTimes(7);
    expect(api.readText).toHaveBeenCalledWith('content/news.json', 'head1');
  });

  it('commits the changed file and new images together', async () => {
    const api = fakeApi();
    const item = { id: 'n-new', date: 'Oct 6, 2026', content: 'Hello' };
    const result = await createGitHubBackend(api).save(
      { kind: 'upsert', collection: 'news', item },
      [image],
      'content: add news item "Hello"',
      current,
    );

    expect(result.commitSha).toBe('commit1');
    expect(result.content.news[0]).toEqual(item);
    expect(api.createBlob).toHaveBeenCalledWith('AAAA');
    expect(api.createTree).toHaveBeenCalledWith('tree1', [
      {
        path: 'content/news.json',
        mode: '100644',
        type: 'blob',
        content: `${JSON.stringify(result.content.news, null, 2)}\n`,
      },
      { path: 'public/images/uploads/x.png', mode: '100644', type: 'blob', sha: 'blob1' },
    ]);
    expect(api.createCommit).toHaveBeenCalledWith('content: add news item "Hello"', 'tree2', 'head1');
    expect(api.updateBranch).toHaveBeenCalledWith('commit1');
  });

  it('applies the edit to the version on GitHub, not to the page copy', async () => {
    const remoteNews = [{ id: 'n-remote', date: 'x', content: 'added on another device' }, ...current.news];
    const api = fakeApi({ news: remoteNews });
    const result = await createGitHubBackend(api).save({ kind: 'delete', collection: 'news', id: 'n1' }, [], 'm', current);
    expect(result.content.news).toEqual([remoteNews[0]]);
    expect(result.content.talks).toBe(current.talks);
  });

  it('starts over when main moved in the meantime', async () => {
    const api = fakeApi();
    api.updateBranch.mockRejectedValueOnce(new GitHubError('GitHub 返回 422', 422));
    const result = await createGitHubBackend(api).save({ kind: 'delete', collection: 'news', id: 'n1' }, [image], 'm', current);
    expect(result.commitSha).toBe('commit1');
    expect(api.headSha).toHaveBeenCalledTimes(2);
    expect(api.createBlob).toHaveBeenCalledTimes(1);
  });

  it('gives up after three conflicts', async () => {
    const api = fakeApi();
    api.updateBranch.mockRejectedValue(new GitHubError('GitHub 返回 422', 422));
    await expect(
      createGitHubBackend(api).save({ kind: 'delete', collection: 'news', id: 'n1' }, [], 'm', current),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(api.updateBranch).toHaveBeenCalledTimes(3);
  });

  it('does not retry other errors', async () => {
    const api = fakeApi();
    api.updateBranch.mockRejectedValue(new GitHubError('GitHub 返回 401', 401));
    await expect(
      createGitHubBackend(api).save({ kind: 'delete', collection: 'news', id: 'n1' }, [], 'm', current),
    ).rejects.toMatchObject({ status: 401 });
    expect(api.updateBranch).toHaveBeenCalledTimes(1);
  });

  it('maps workflow runs to deployment states', async () => {
    const api = fakeApi();
    const backend = createGitHubBackend(api);
    expect(await backend.deployStatus('c')).toEqual({ state: 'pending' });
    api.latestRun.mockResolvedValueOnce({ status: 'in_progress', conclusion: null, html_url: 'u' });
    expect(await backend.deployStatus('c')).toEqual({ state: 'pending', url: 'u' });
    api.latestRun.mockResolvedValueOnce({ status: 'completed', conclusion: 'success', html_url: 'u' });
    expect(await backend.deployStatus('c')).toEqual({ state: 'success', url: 'u' });
    api.latestRun.mockResolvedValueOnce({ status: 'completed', conclusion: 'failure', html_url: 'u' });
    expect(await backend.deployStatus('c')).toEqual({ state: 'failure', url: 'u' });
  });
});

describe('describeSaveError', () => {
  it('explains common failures in plain words', () => {
    expect(describeSaveError(new ConflictError())).toMatch('别处');
    expect(describeSaveError(new GitHubError('x', 401))).toMatch('登录已过期');
    expect(describeSaveError(new GitHubError('x', 403))).toMatch('没有写入权限');
    expect(describeSaveError(new GitHubError('x', 0))).toMatch('网络');
    expect(describeSaveError(new GitHubError('x', 500))).toMatch('500');
  });
});
```

Run: `npx vitest run editor/github.test.ts editor/backend.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 2：实现 `editor/github.ts`**

```ts file=editor/github.ts
export class GitHubError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface RepoRef {
  owner: string;
  repo: string;
  branch: string;
}

export interface TreeEntry {
  path: string;
  mode: '100644';
  type: 'blob';
  sha?: string;
  content?: string;
}

export interface WorkflowRun {
  status: string;
  conclusion: string | null;
  html_url: string;
}

export interface GitHubApi {
  headSha(): Promise<string>;
  treeSha(commitSha: string): Promise<string>;
  readText(path: string, ref: string): Promise<string>;
  createBlob(base64: string): Promise<string>;
  createTree(baseTree: string, entries: TreeEntry[]): Promise<string>;
  createCommit(message: string, tree: string, parent: string): Promise<string>;
  updateBranch(commitSha: string): Promise<void>;
  latestRun(headSha: string): Promise<WorkflowRun | null>;
}

/** The contents API returns base64 with line breaks; the text itself is UTF-8. */
export function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

export function createGitHubApi(
  token: string,
  repo: RepoRef,
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
): GitHubApi {
  const base = `https://api.github.com/repos/${repo.owner}/${repo.repo}`;

  async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetchImpl(`${base}${path}`, {
        method,
        // The API sends max-age=60; a cached branch head would make every save conflict.
        cache: 'no-store',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new GitHubError('网络连接失败', 0);
    }
    if (!res.ok) throw new GitHubError(`GitHub 返回 ${res.status}`, res.status);
    return (await res.json()) as T;
  }

  return {
    headSha: async () => (await request<{ object: { sha: string } }>(`/git/ref/heads/${repo.branch}`)).object.sha,
    treeSha: async (commitSha) => (await request<{ tree: { sha: string } }>(`/git/commits/${commitSha}`)).tree.sha,
    readText: async (path, ref) =>
      decodeBase64Utf8((await request<{ content: string }>(`/contents/${path}?ref=${ref}`)).content),
    createBlob: async (base64) =>
      (await request<{ sha: string }>('/git/blobs', 'POST', { content: base64, encoding: 'base64' })).sha,
    createTree: async (baseTree, entries) =>
      (await request<{ sha: string }>('/git/trees', 'POST', { base_tree: baseTree, tree: entries })).sha,
    createCommit: async (message, tree, parent) =>
      (await request<{ sha: string }>('/git/commits', 'POST', { message, tree, parents: [parent] })).sha,
    updateBranch: async (commitSha) => {
      await request(`/git/refs/heads/${repo.branch}`, 'PATCH', { sha: commitSha, force: false });
    },
    latestRun: async (headSha) =>
      (await request<{ workflow_runs: WorkflowRun[] }>(`/actions/runs?head_sha=${headSha}&per_page=1`)).workflow_runs[0] ??
      null,
  };
}
```

- [ ] **Step 3：实现 `editor/backend.ts`**

```ts file=editor/backend.ts
import { EDITOR_CONFIG } from './config';
import { GitHubApi, GitHubError, TreeEntry, createGitHubApi } from './github';
import { ContentOp, applyOp } from './ops';
import { Session } from '../lib/session';
import { SiteContent } from '../types';

export interface ImageUpload {
  /** Repository path, e.g. "public/images/uploads/20261006-153012-logo.png". */
  path: string;
  base64: string;
  previewUrl: string;
}

export type DeployState = 'pending' | 'success' | 'failure' | 'unknown';

export interface DeployStatus {
  state: DeployState;
  url?: string;
}

export interface SaveResult {
  content: SiteContent;
  commitSha: string;
}

export interface EditorBackend {
  load(): Promise<SiteContent>;
  /** Applies the edit to the latest version on GitHub and commits it together with the images. */
  save(op: ContentOp, uploads: ImageUpload[], message: string, current: SiteContent): Promise<SaveResult>;
  deployStatus(commitSha: string): Promise<DeployStatus>;
}

export class ConflictError extends Error {
  constructor() {
    super('内容已在别处修改，请刷新页面后再试');
  }
}

const COLLECTIONS = ['profile', 'news', 'experiences', 'publications', 'projects', 'talks', 'awards'] as const;
const MAX_ATTEMPTS = 3;

export const contentPath = (collection: keyof SiteContent): string => `content/${collection}.json`;

const serialize = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

export function createGitHubBackend(api: GitHubApi): EditorBackend {
  return {
    async load() {
      const head = await api.headSha();
      const entries = await Promise.all(
        COLLECTIONS.map(async (collection) => [collection, JSON.parse(await api.readText(contentPath(collection), head))]),
      );
      return Object.fromEntries(entries) as SiteContent;
    },

    async save(op, uploads, message, current) {
      const images: TreeEntry[] = await Promise.all(
        uploads.map(async (upload) => ({
          path: upload.path,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: await api.createBlob(upload.base64),
        })),
      );
      for (let attempt = 1; ; attempt += 1) {
        const head = await api.headSha();
        const fresh: unknown = JSON.parse(await api.readText(contentPath(op.collection), head));
        const content = applyOp({ ...current, [op.collection]: fresh } as SiteContent, op);
        const tree = await api.createTree(await api.treeSha(head), [
          { path: contentPath(op.collection), mode: '100644', type: 'blob', content: serialize(content[op.collection]) },
          ...images,
        ]);
        const commitSha = await api.createCommit(message, tree, head);
        try {
          await api.updateBranch(commitSha);
          return { content, commitSha };
        } catch (error) {
          // 422: main moved after we read it (e.g. a save from another device). Start over from the new head.
          if (!(error instanceof GitHubError && error.status === 422)) throw error;
          if (attempt >= MAX_ATTEMPTS) throw new ConflictError();
        }
      }
    },

    async deployStatus(commitSha) {
      const run = await api.latestRun(commitSha);
      if (!run) return { state: 'pending' };
      if (run.status !== 'completed') return { state: 'pending', url: run.html_url };
      return { state: run.conclusion === 'success' ? 'success' : 'failure', url: run.html_url };
    },
  };
}

export function describeSaveError(error: unknown): string {
  if (error instanceof ConflictError) return error.message;
  if (error instanceof GitHubError) {
    if (error.status === 401) return '登录已过期，请先复制你的修改，再重新登录后保存';
    if (error.status === 403 || error.status === 404) return '没有写入权限，请确认 GitHub App 已安装到这个仓库';
    if (error.status === 0) return '网络连接失败，请检查网络后重试';
    return `保存失败（GitHub 返回 ${error.status}），请稍后重试`;
  }
  return error instanceof Error ? error.message : '保存失败，请稍后重试';
}

export async function createBackend(session: Session): Promise<EditorBackend> {
  // Written out in full (not MOCK_MODE) so production builds drop the mock module entirely.
  if (import.meta.env.DEV && import.meta.env.VITE_EDITOR_MOCK === 'true') {
    const { createMockBackend } = await import('./mockBackend');
    return createMockBackend();
  }
  return createGitHubBackend(createGitHubApi(session.token, EDITOR_CONFIG));
}
```

- [ ] **Step 4：实现 `editor/mockBackend.ts`**

```ts file=editor/mockBackend.ts
import { bundledContent } from '../content';
import { SiteContent } from '../types';
import { ConflictError, DeployStatus, EditorBackend } from './backend';
import { GitHubError } from './github';
import { applyOp } from './ops';

const DEPLOY_MS = 8_000;
const ACTIONS_URL = 'https://github.com/zihanzhao1022/zihanzhao1022.github.io/actions';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Simulate failures while testing by hand, e.g. localStorage.setItem('mock-fail', 'conflict').
// Values: conflict | network | expired | deploy.
const failure = (): string | null => {
  try {
    return localStorage.getItem('mock-fail');
  } catch {
    return null;
  }
};

/** An in-memory stand-in for GitHub, used by `npm run dev:mock`. */
export function createMockBackend(): EditorBackend {
  let remote: SiteContent = structuredClone(bundledContent);
  const readyAt = new Map<string, number>();
  let commits = 0;

  return {
    async load() {
      await wait(500);
      return structuredClone(remote);
    },

    async save(op, uploads, message, current) {
      await wait(800);
      const mode = failure();
      if (mode === 'conflict') throw new ConflictError();
      if (mode === 'network') throw new GitHubError('网络连接失败', 0);
      if (mode === 'expired') throw new GitHubError('GitHub 返回 401', 401);
      const content = applyOp({ ...current, [op.collection]: remote[op.collection] } as SiteContent, op);
      remote = { ...remote, [op.collection]: content[op.collection] } as SiteContent;
      commits += 1;
      const commitSha = `mock-${commits}`;
      readyAt.set(commitSha, Date.now() + DEPLOY_MS);
      console.info(`[mock commit] ${message}`, uploads.map((upload) => upload.path));
      return { content, commitSha };
    },

    async deployStatus(commitSha): Promise<DeployStatus> {
      if (Date.now() < (readyAt.get(commitSha) ?? 0)) return { state: 'pending' };
      return { state: failure() === 'deploy' ? 'failure' : 'success', url: ACTIONS_URL };
    },
  };
}
```

- [ ] **Step 5：运行测试，确认通过**

Run: `npx vitest run editor/github.test.ts editor/backend.test.ts && npx tsc`
Expected: `13 passed`（github 5 + backend 8）；`tsc` 无输出。

- [ ] **Step 6：提交**

```bash
git add editor/github.ts editor/github.test.ts editor/backend.ts editor/backend.test.ts editor/mockBackend.ts
git commit -m "feat: save edits to GitHub as single commits, with a mock backend for dev

Each save re-reads the file from the branch head, applies the edit and
commits it with any images; a moved branch triggers up to three retries.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6：图片处理与本地预览

**Files:**
- Create: `editor/images.ts`、`lib/localImages.ts`
- Test: `editor/images.test.ts`

**Interfaces:**
- Produces（`editor/images.ts`）：
  - 常量与类型：`MAX_IMAGE_BYTES`、`MAX_IMAGE_EDGE`、`PendingImage { pending: true; fileName; type; base64; previewUrl }`。
  - 校验与命名：`isPendingImage(value)`、`validateImage(file): string | null`、`scaledSize(w, h, max?)`、`uploadPath(fileName, type, now, index?)`、`publicUrl(repoPath)`。
  - 浏览器端处理：`prepareImage(file): Promise<PendingImage>`。
- Produces（`lib/localImages.ts`）：`registerLocalImage(url, previewUrl)`、`resolveImage(url)`。

- [ ] **Step 1：编写失败的测试**

```ts file=editor/images.test.ts
import { describe, expect, it } from 'vitest';
import { publicUrl, scaledSize, uploadPath, validateImage } from './images';

describe('validateImage', () => {
  it('accepts common web formats up to 5MB', () => {
    expect(validateImage({ type: 'image/png', size: 1000 })).toBeNull();
    expect(validateImage({ type: 'image/jpeg', size: 5 * 1024 * 1024 })).toBeNull();
  });

  it('rejects SVG, other files and large images', () => {
    expect(validateImage({ type: 'image/svg+xml', size: 10 })).toMatch('PNG');
    expect(validateImage({ type: 'application/pdf', size: 10 })).toMatch('PNG');
    expect(validateImage({ type: 'image/webp', size: 5 * 1024 * 1024 + 1 })).toBe('图片不能超过 5MB');
  });
});

describe('scaledSize', () => {
  it('leaves images within the limit alone', () => {
    expect(scaledSize(1600, 900)).toBeNull();
  });

  it('scales the longest edge down to the limit', () => {
    expect(scaledSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(scaledSize(1000, 3200)).toEqual({ width: 500, height: 1600 });
  });
});

describe('uploadPath', () => {
  const now = new Date(Date.UTC(2026, 9, 6, 15, 30, 12));

  it('builds a timestamped, slugged path', () => {
    expect(uploadPath('Hosei Logo.PNG', 'image/png', now)).toBe('public/images/uploads/20261006-153012-hosei-logo.png');
  });

  it('falls back to "image" for names without ASCII letters', () => {
    expect(uploadPath('微信二维码.jpeg', 'image/jpeg', now)).toBe('public/images/uploads/20261006-153012-image.jpg');
  });

  it('adds a suffix for later images in the same save', () => {
    expect(uploadPath('qr.png', 'image/png', now, 2)).toBe('public/images/uploads/20261006-153012-qr-2.png');
  });
});

describe('publicUrl', () => {
  it('maps a public/ path to the URL the site serves it from', () => {
    expect(publicUrl('public/images/uploads/a.png')).toBe('/images/uploads/a.png');
  });
});
```

Run: `npx vitest run editor/images.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 2：实现 `editor/images.ts`**

```ts file=editor/images.ts
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 1600;

// SVG is left out on purpose: served from this origin it could run scripts and read the login token.
const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** An image picked in a form but not committed yet. */
export interface PendingImage {
  pending: true;
  fileName: string;
  type: string;
  base64: string;
  previewUrl: string;
}

export const isPendingImage = (value: unknown): value is PendingImage =>
  typeof value === 'object' && value !== null && (value as PendingImage).pending === true;

export function validateImage(file: { type: string; size: number }): string | null {
  if (!EXTENSIONS[file.type]) return '只支持 PNG、JPG、WebP、GIF 格式的图片';
  if (file.size > MAX_IMAGE_BYTES) return '图片不能超过 5MB';
  return null;
}

/** The size to scale down to when the longest edge exceeds maxEdge, otherwise null. */
export function scaledSize(width: number, height: number, maxEdge = MAX_IMAGE_EDGE): { width: number; height: number } | null {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return null;
  const ratio = maxEdge / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** e.g. public/images/uploads/20261006-153012-hosei-logo.png (UTC). `index` keeps names unique within one save. */
export function uploadPath(fileName: string, type: string, now: Date, index = 0): string {
  const stamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  const slug =
    fileName
      .replace(/\.[^.]*$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'image';
  return `public/images/uploads/${stamp}-${slug}${index ? `-${index}` : ''}.${EXTENSIONS[type] ?? 'png'}`;
}

/** Converts a repository path under public/ into the URL the site serves it from. */
export const publicUrl = (repoPath: string): string => repoPath.replace(/^public/, '');

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Shrinks large images in the browser (keeping their format) and reads them for upload. */
export async function prepareImage(file: File): Promise<PendingImage> {
  let blob: Blob = file;
  if (file.type !== 'image/gif') {
    const bitmap = await createImageBitmap(file);
    const size = scaledSize(bitmap.width, bitmap.height);
    if (size) {
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, size.width, size.height);
      blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('图片处理失败'))), file.type, 0.9),
      );
    }
    bitmap.close();
  }
  return {
    pending: true,
    fileName: file.name,
    type: file.type,
    base64: await toBase64(blob),
    previewUrl: URL.createObjectURL(blob),
  };
}
```

- [ ] **Step 3：实现 `lib/localImages.ts`**

```ts file=lib/localImages.ts
// Images uploaded in this tab are shown from local previews until the deployment containing them is live.
const previews = new Map<string, string>();

export function registerLocalImage(url: string, previewUrl: string): void {
  previews.set(url, previewUrl);
}

export function resolveImage(url: string): string;
export function resolveImage(url: string | undefined): string | undefined;
export function resolveImage(url: string | undefined): string | undefined {
  return url ? (previews.get(url) ?? url) : url;
}
```

- [ ] **Step 4：运行测试，确认通过**

Run: `npx vitest run editor/images.test.ts && npx tsc`
Expected: `8 passed`；`tsc` 无输出。

- [ ] **Step 5：提交**

```bash
git add editor/images.ts editor/images.test.ts lib/localImages.ts
git commit -m "feat: validate, shrink and name image uploads

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7：表单定义与数据转换

**Files:**
- Create: `editor/schemas.ts`
- Test: `editor/schemas.test.ts`

**Interfaces:**
- Consumes：`ImageUpload`（Task 5）；`isPendingImage`、`uploadPath`、`publicUrl`、`PendingImage`（Task 6）。
- Produces：
  - 类型：`Values`、`FormState`、`Option`、`Column`、`Field`、`FormSchema`、`ListSchema`。
  - 表单定义：`LIST_SCHEMAS: Record<ListCollection, ListSchema>`、`PROFILE_SCHEMAS: Record<ProfileSection, FormSchema>`。
  - 数据转换：`visibleFields(schema, state)`、`newItem(collection, preset?)`、`getPath(item, path)`、`toFormState(schema, item)`、`fromFormState(schema, state, original, now): { item; uploads }`、`profileFields(schema, item)`。
  - 校验：`validateForm(schema, state): Record<string, string>`。

- [ ] **Step 1：编写失败的测试**

```ts file=editor/schemas.test.ts
import { describe, expect, it } from 'vitest';
import { PendingImage } from './images';
import {
  LIST_SCHEMAS,
  PROFILE_SCHEMAS,
  fromFormState,
  newItem,
  profileFields,
  toFormState,
  validateForm,
} from './schemas';

const now = new Date(Date.UTC(2026, 9, 6, 15, 30, 12));
const pending = (fileName: string): PendingImage => ({
  pending: true,
  fileName,
  type: 'image/png',
  base64: 'AAAA',
  previewUrl: `blob:${fileName}`,
});

const publication = {
  id: 'p2',
  title: 'Federated Large Domain Model System',
  authors: ['Chunming Rong', '**Zihan Zhao**'],
  year: 2025,
  venue: 'Blockchain: Research and Applications',
  type: 'journal',
  rank: 'Q1',
  impactFactor: '6.9',
  image: '',
  highlight: true,
  links: { abs: '#', doi: '#', pdf: '#' },
};

describe('publication form', () => {
  const schema = LIST_SCHEMAS.publications;

  it('round-trips an unchanged item and keeps fields the form does not show', () => {
    const { item, uploads } = fromFormState(schema, toFormState(schema, publication), publication, now);
    expect(uploads).toEqual([]);
    expect(item).toEqual({ ...publication, image: undefined });
    expect(item.highlight).toBe(true);
  });

  it('converts lines, years and nested links', () => {
    const state = {
      ...toFormState(schema, publication),
      authors: ' A \n\n **Zihan Zhao** \n',
      year: '2026',
      'links.pdf': '',
      'links.code': 'https://github.com/x',
    };
    const { item } = fromFormState(schema, state, publication, now);
    expect(item.authors).toEqual(['A', '**Zihan Zhao**']);
    expect(item.year).toBe(2026);
    expect(item.links).toEqual({ abs: '#', doi: '#', code: 'https://github.com/x' });
  });

  it('leaves hidden fields as they were', () => {
    const state = { ...toFormState(schema, publication), type: 'conference', impactFactor: '' };
    expect(fromFormState(schema, state, publication, now).item.impactFactor).toBe('6.9');
  });

  it('validates required fields and the year', () => {
    const state = { ...toFormState(schema, publication), title: '  ', year: '25' };
    expect(validateForm(schema, state)).toEqual({ title: '请填写标题', year: '请填写四位数字的年份' });
  });

  it('starts new papers with sensible defaults', () => {
    const item = newItem('publications');
    expect(item.id).toMatch(/^p-[0-9a-z]+$/);
    expect(item).toMatchObject({ type: 'journal', rank: 'Q1', authors: ['**Zihan Zhao**'] });
  });
});

describe('award form', () => {
  const schema = LIST_SCHEMAS.awards;
  const award = { id: 'aw1', title: 'T', date: 'Sep 2025', year: 2025, issuer: 'Hosei', type: 'scholarship' };

  it('takes the year from the date', () => {
    const { item } = fromFormState(schema, { ...toFormState(schema, award), date: 'Mar 2026' }, award, now);
    expect(item.year).toBe(2026);
  });

  it('needs a year in the date', () => {
    expect(validateForm(schema, { ...toFormState(schema, award), date: 'Spring' })).toEqual({
      date: '需要包含四位数字的年份',
    });
  });
});

describe('experience form', () => {
  const schema = LIST_SCHEMAS.experiences;
  const experience = {
    id: 'work1',
    category: 'work',
    title: 'TA',
    institution: 'Hosei',
    location: 'Tokyo',
    date: '2024',
    image: '/images/old.png',
  };

  it('uploads a newly picked logo with the save', () => {
    const state = { ...toFormState(schema, experience), image: pending('Hosei Logo.png') };
    const { item, uploads } = fromFormState(schema, state, experience, now);
    expect(item.image).toBe('/images/uploads/20261006-153012-hosei-logo.png');
    expect(uploads).toEqual([
      { path: 'public/images/uploads/20261006-153012-hosei-logo.png', base64: 'AAAA', previewUrl: 'blob:Hosei Logo.png' },
    ]);
  });

  it('only asks for education details on education entries', () => {
    expect(validateForm(schema, { ...toFormState(schema, experience), title: '' })).toEqual({ title: '请填写学位 / 职位' });
  });
});

describe('profile forms', () => {
  const profile = {
    name: { first: 'Zihan', last: 'ZHAO', chinese: '子涵 赵' },
    title: 'PhD Candidate',
    affiliation: 'Osaka',
    email: 'a@b.c',
    bio: ['One', 'Two'],
    avatar: '/images/zzh.png',
    socials: [
      { platform: 'email', url: 'mailto:a@b.c' },
      { platform: 'wechat', url: '#', qrCode: '/images/wechat_qr.jpg' },
    ],
    languages: [{ language: 'Chinese', proficiency: 'Native' }],
    skills: ['x'],
  };

  it('splits the bio on blank lines and patches only the bio', () => {
    const schema = PROFILE_SCHEMAS.bio;
    const { item } = fromFormState(schema, { bio: 'First [x](https://x.org)\n\n\nSecond\nline' }, profile, now);
    expect(profileFields(schema, item)).toEqual({ bio: ['First [x](https://x.org)', 'Second\nline'] });
  });

  it('edits rows, including a new QR code', () => {
    const schema = PROFILE_SCHEMAS.socials;
    const state = toFormState(schema, profile);
    const rows = state.socials as Record<string, unknown>[];
    rows[1] = { ...rows[1], qrCode: pending('qr.png') };
    const { item, uploads } = fromFormState(schema, state, profile, now);
    expect(profileFields(schema, item)).toEqual({
      socials: [
        { platform: 'email', url: 'mailto:a@b.c' },
        { platform: 'wechat', url: '#', qrCode: '/images/uploads/20261006-153012-qr.png' },
      ],
    });
    expect(uploads).toHaveLength(1);
  });

  it('says which row is incomplete', () => {
    const schema = PROFILE_SCHEMAS.basics;
    const state = {
      ...toFormState(schema, profile),
      languages: [
        { language: 'Chinese', proficiency: 'Native' },
        { language: '', proficiency: 'B2' },
      ],
    };
    expect(validateForm(schema, state)).toEqual({ languages: '请填写第 2 行的语言' });
  });

  it('patches the basic fields and nothing else', () => {
    const schema = PROFILE_SCHEMAS.basics;
    const { item } = fromFormState(schema, { ...toFormState(schema, profile), 'name.chinese': '' }, profile, now);
    expect(Object.keys(profileFields(schema, item)).sort()).toEqual(['affiliation', 'email', 'languages', 'name', 'title']);
    expect(item.name).toEqual({ first: 'Zihan', last: 'ZHAO' });
  });
});
```

Run: `npx vitest run editor/schemas.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 2：实现 `editor/schemas.ts`**

```ts file=editor/schemas.ts
import { ListCollection, Profile, ProfileSection, Rank } from '../types';
import { ImageUpload } from './backend';
import { isPendingImage, publicUrl, uploadPath } from './images';

export type Values = Record<string, unknown>;

/** Form values keyed by field key. Text-like fields hold raw strings; rows hold arrays of row objects. */
export type FormState = Record<string, unknown>;

export interface Option {
  value: string;
  label: string;
}

export interface Column {
  key: string;
  label: string;
  type: 'text' | 'select' | 'image';
  options?: Option[];
  required?: boolean;
  placeholder?: string;
}

export interface Field {
  /** Dotted path into the item, e.g. "links.pdf". */
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'markdown' | 'lines' | 'paragraphs' | 'year' | 'select' | 'image' | 'rows';
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: Option[];
  columns?: Column[];
  addLabel?: string;
  pattern?: { regex: RegExp; message: string };
  showIf?: (state: FormState) => boolean;
}

export interface FormSchema {
  addTitle?: string;
  editTitle: string;
  fields: Field[];
  /** Identifies an item in commit messages and the reorder dialog. */
  label: (item: Values) => string;
  /** Derives stored values from edited ones, e.g. an award's year from its date. */
  finalize?: (item: Values) => Values;
  /** Starting values for a new item. */
  defaults?: () => Values;
}

export interface ListSchema extends FormSchema {
  addTitle: string;
  idPrefix: string;
}

const LINK_HELP = '支持 [文字](链接) 和 **加粗**';
const YEAR_IN_TEXT = { regex: /\d{4}/, message: '需要包含四位数字的年份' };
const RANKS: Rank[] = ['Q1', 'Q2', 'Q3', 'Q4', 'CORE-A*', 'CORE-A', 'CORE-B', 'CORE-C', 'Unranked'];

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const isEducation = (state: FormState): boolean => state.category === 'education';

export const LIST_SCHEMAS: Record<ListCollection, ListSchema> = {
  news: {
    addTitle: '添加新闻',
    editTitle: '编辑新闻',
    idPrefix: 'n',
    label: (item) => text(item.content),
    fields: [
      { key: 'date', label: '日期', type: 'text', required: true, placeholder: 'Oct 6, 2026' },
      { key: 'content', label: '内容', type: 'markdown', required: true, help: LINK_HELP },
    ],
  },
  experiences: {
    addTitle: '添加经历',
    editTitle: '编辑经历',
    idPrefix: 'exp',
    label: (item) => text(item.title),
    defaults: () => ({ category: 'education' }),
    fields: [
      {
        key: 'category',
        label: '分类',
        type: 'select',
        required: true,
        options: [
          { value: 'education', label: '教育' },
          { value: 'work', label: '工作' },
          { value: 'volunteer', label: '志愿与服务' },
        ],
      },
      { key: 'title', label: '学位 / 职位', type: 'text', required: true },
      { key: 'institution', label: '机构', type: 'text', required: true },
      { key: 'department', label: '院系', type: 'text', showIf: isEducation },
      { key: 'location', label: '地点', type: 'text', required: true, placeholder: 'Tokyo, Japan' },
      { key: 'date', label: '时间', type: 'text', required: true, placeholder: 'Sep. 2023 - Present' },
      { key: 'gpa', label: 'GPA', type: 'text', showIf: isEducation, placeholder: '3.5/4.0' },
      { key: 'rank', label: '排名', type: 'text', showIf: isEducation, placeholder: 'Top 5%' },
      { key: 'description', label: '描述', type: 'textarea', showIf: (state) => !isEducation(state) },
      { key: 'image', label: 'Logo', type: 'image' },
    ],
  },
  publications: {
    addTitle: '添加论文',
    editTitle: '编辑论文',
    idPrefix: 'p',
    label: (item) => text(item.title),
    defaults: () => ({ type: 'journal', rank: 'Q1', year: new Date().getFullYear(), authors: ['**Zihan Zhao**'] }),
    fields: [
      { key: 'title', label: '标题', type: 'textarea', required: true },
      {
        key: 'authors',
        label: '作者',
        type: 'lines',
        required: true,
        help: '每行一位；用 **名字** 加粗并加下划线（本人或共同一作）',
      },
      { key: 'year', label: '年份', type: 'year', required: true },
      { key: 'venue', label: '期刊 / 会议', type: 'text', required: true },
      {
        key: 'type',
        label: '类型',
        type: 'select',
        required: true,
        options: [
          { value: 'journal', label: '期刊' },
          { value: 'conference', label: '会议' },
        ],
      },
      {
        key: 'rank',
        label: '等级',
        type: 'select',
        required: true,
        options: RANKS.map((rank) => ({ value: rank, label: rank === 'Unranked' ? '其他（显示为 Else）' : rank })),
      },
      {
        key: 'impactFactor',
        label: '影响因子',
        type: 'text',
        placeholder: '6.9',
        showIf: (state) => state.type === 'journal',
      },
      { key: 'image', label: '缩略图', type: 'image' },
      { key: 'links.abs', label: 'Abstract 链接', type: 'text', placeholder: 'https://' },
      { key: 'links.pdf', label: 'PDF 链接', type: 'text', placeholder: 'https://' },
      { key: 'links.doi', label: 'DOI 链接', type: 'text', placeholder: 'https://doi.org/…' },
      { key: 'links.code', label: '代码链接', type: 'text', placeholder: 'https://github.com/…' },
    ],
  },
  projects: {
    addTitle: '添加项目',
    editTitle: '编辑项目',
    idPrefix: 'prj',
    label: (item) => text(item.title),
    fields: [
      { key: 'title', label: '项目名称', type: 'textarea', required: true },
      { key: 'role', label: '角色', type: 'text', required: true, placeholder: 'Project Leader' },
      { key: 'description', label: '简介', type: 'textarea', required: true },
      {
        key: 'year',
        label: '时间',
        type: 'text',
        required: true,
        placeholder: 'Mar. 2023 - May 2023',
        pattern: YEAR_IN_TEXT,
        help: '按其中第一个年份分组排序',
      },
      { key: 'level', label: '级别', type: 'text', required: true, placeholder: 'National Key R&D Program' },
      { key: 'image', label: '图片', type: 'image' },
    ],
  },
  talks: {
    addTitle: '添加报告',
    editTitle: '编辑报告',
    idPrefix: 't',
    label: (item) => text(item.title),
    fields: [
      { key: 'title', label: '题目', type: 'textarea', required: true },
      { key: 'event', label: '活动名称', type: 'text', placeholder: 'AI Seminar Series' },
      { key: 'date', label: '日期', type: 'text', required: true, placeholder: 'Dec 2024' },
      { key: 'host', label: '主办方', type: 'text', required: true },
      { key: 'location', label: '地点', type: 'text', required: true },
      { key: 'collaborators', label: '合作方', type: 'text' },
    ],
  },
  awards: {
    addTitle: '添加奖项',
    editTitle: '编辑奖项',
    idPrefix: 'aw',
    label: (item) => text(item.title),
    defaults: () => ({ type: 'international' }),
    finalize: (item) => ({ ...item, year: Number(text(item.date).match(/\d{4}/)?.[0] ?? item.year) }),
    fields: [
      { key: 'title', label: '奖项名称', type: 'textarea', required: true },
      { key: 'issuer', label: '颁发机构', type: 'text', required: true },
      {
        key: 'date',
        label: '日期',
        type: 'text',
        required: true,
        placeholder: 'Sep 2025',
        pattern: YEAR_IN_TEXT,
        help: '按其中的年份分组',
      },
      {
        key: 'type',
        label: '类型',
        type: 'select',
        required: true,
        options: [
          { value: 'international', label: '国际' },
          { value: 'national', label: '国家级（中国）' },
          { value: 'provincial', label: '省级（中国）' },
          { value: 'scholarship', label: '奖学金' },
        ],
      },
      {
        key: 'level',
        label: '等级',
        type: 'text',
        placeholder: 'First Prize',
        help: '含 Gold / First、Silver / Second、Bronze / Third 时自动配色',
      },
      { key: 'prize', label: '奖金', type: 'text', placeholder: 'JPY 200,000' },
      { key: 'image', label: '图片', type: 'image' },
    ],
  },
};

const PLATFORMS: Option[] = [
  { value: 'email', label: 'Email' },
  { value: 'github', label: 'GitHub' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'orcid', label: 'ORCID' },
  { value: 'wechat', label: '微信' },
];

export const PROFILE_SCHEMAS: Record<ProfileSection, FormSchema> = {
  basics: {
    editTitle: '编辑基本信息',
    label: () => 'basics',
    fields: [
      { key: 'name.first', label: '名（First name）', type: 'text', required: true },
      { key: 'name.last', label: '姓（Last name）', type: 'text', required: true },
      { key: 'name.chinese', label: '中文名', type: 'text' },
      { key: 'title', label: '职位', type: 'text', required: true, placeholder: 'PhD Candidate' },
      { key: 'affiliation', label: '单位', type: 'text', required: true },
      { key: 'email', label: '邮箱', type: 'text', required: true },
      {
        key: 'languages',
        label: '语言',
        type: 'rows',
        addLabel: '添加语言',
        columns: [
          { key: 'language', label: '语言', type: 'text', required: true },
          { key: 'proficiency', label: '水平', type: 'text', required: true },
        ],
      },
    ],
  },
  bio: {
    editTitle: '编辑简介',
    label: () => 'bio',
    fields: [{ key: 'bio', label: '简介', type: 'paragraphs', required: true, help: `段落之间空一行；${LINK_HELP}` }],
  },
  avatar: {
    editTitle: '更换头像',
    label: () => 'avatar',
    fields: [{ key: 'avatar', label: '头像', type: 'image', required: true }],
  },
  socials: {
    editTitle: '编辑联系方式',
    label: () => 'socials',
    fields: [
      {
        key: 'socials',
        label: '联系方式',
        type: 'rows',
        addLabel: '添加联系方式',
        help: '微信的链接可以填 #，并上传二维码；访客点图标时会显示二维码',
        columns: [
          { key: 'platform', label: '平台', type: 'select', options: PLATFORMS, required: true },
          { key: 'url', label: '链接', type: 'text', required: true, placeholder: 'https://' },
          { key: 'qrCode', label: '二维码', type: 'image' },
        ],
      },
    ],
  },
};

export function visibleFields(schema: FormSchema, state: FormState): Field[] {
  return schema.fields.filter((field) => !field.showIf || field.showIf(state));
}

export function newItem(collection: ListCollection, preset: Values = {}): Values {
  const schema = LIST_SCHEMAS[collection];
  return { id: `${schema.idPrefix}-${Date.now().toString(36)}`, ...schema.defaults?.(), ...preset };
}

export function getPath(item: Values, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((value, key) => (value !== null && typeof value === 'object' ? (value as Values)[key] : undefined), item);
}

/** Sets a dotted path; undefined deletes the key (and never creates empty parents). */
function setPath(item: Values, path: string, value: unknown): void {
  const keys = path.split('.');
  const last = keys.pop() as string;
  let target = item;
  for (const key of keys) {
    const next = target[key];
    if (next === null || typeof next !== 'object') {
      if (value === undefined) return;
      target[key] = {};
    }
    target = target[key] as Values;
  }
  if (value === undefined) delete target[last];
  else target[last] = value;
}

const trimmed = (value: unknown): string | undefined => {
  const result = text(value).trim();
  return result === '' ? undefined : result;
};

export function toFormState(schema: FormSchema, item: Values): FormState {
  const state: FormState = {};
  for (const field of schema.fields) {
    const value = getPath(item, field.key);
    if (field.type === 'lines') state[field.key] = Array.isArray(value) ? value.join('\n') : '';
    else if (field.type === 'paragraphs') state[field.key] = Array.isArray(value) ? value.join('\n\n') : '';
    else if (field.type === 'rows') state[field.key] = Array.isArray(value) ? value.map((row) => ({ ...(row as Values) })) : [];
    else if (field.type === 'year') state[field.key] = typeof value === 'number' ? String(value) : text(value);
    else state[field.key] = text(value);
  }
  return state;
}

const isBlank = (field: Field, value: unknown): boolean => {
  if (field.type === 'rows') return !Array.isArray(value) || value.length === 0;
  if (field.type === 'image') return !value;
  return text(value).trim() === '';
};

const isBlankCell = (column: Column, value: unknown): boolean => (column.type === 'image' ? !value : text(value).trim() === '');

const requiredMessage = (field: Field): string => {
  if (field.type === 'image') return `请上传${field.label}`;
  if (field.type === 'select') return `请选择${field.label}`;
  return `请填写${field.label}`;
};

export function validateForm(schema: FormSchema, state: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of visibleFields(schema, state)) {
    const value = state[field.key];
    if (isBlank(field, value)) {
      if (field.required) errors[field.key] = requiredMessage(field);
      continue;
    }
    if (field.type === 'year' && !/^\d{4}$/.test(text(value).trim())) {
      errors[field.key] = '请填写四位数字的年份';
    } else if (field.pattern && !field.pattern.regex.test(text(value))) {
      errors[field.key] = field.pattern.message;
    } else if (field.type === 'rows') {
      const missing = (value as Values[]).flatMap((row, index) =>
        (field.columns ?? [])
          .filter((column) => column.required && isBlankCell(column, row[column.key]))
          .map((column) => `第 ${index + 1} 行的${column.label}`),
      );
      if (missing.length > 0) errors[field.key] = `请填写${missing[0]}`;
    }
  }
  return errors;
}

/**
 * Applies the form to a copy of the original item. Fields the form doesn't show keep their values;
 * cleared optional fields are removed; picked images become upload entries.
 */
export function fromFormState(
  schema: FormSchema,
  state: FormState,
  original: Values,
  now: Date,
): { item: Values; uploads: ImageUpload[] } {
  const item = structuredClone(original);
  const uploads: ImageUpload[] = [];
  const image = (value: unknown): string | undefined => {
    if (!isPendingImage(value)) return trimmed(value);
    const path = uploadPath(value.fileName, value.type, now, uploads.length);
    uploads.push({ path, base64: value.base64, previewUrl: value.previewUrl });
    return publicUrl(path);
  };

  for (const field of visibleFields(schema, state)) {
    const value = state[field.key];
    let next: unknown;
    switch (field.type) {
      case 'lines': {
        const lines = text(value)
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        next = lines.length > 0 ? lines : undefined;
        break;
      }
      case 'paragraphs': {
        const paragraphs = text(value)
          .split(/\n\s*\n/)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean);
        next = paragraphs.length > 0 ? paragraphs : undefined;
        break;
      }
      case 'year': {
        const year = trimmed(value);
        next = year === undefined ? undefined : Number(year);
        break;
      }
      case 'image':
        next = image(value);
        break;
      case 'rows':
        next = (value as Values[]).map((row) => {
          const out: Values = { ...row };
          for (const column of field.columns ?? []) {
            const cell = column.type === 'image' ? image(row[column.key]) : trimmed(row[column.key]);
            if (cell === undefined) delete out[column.key];
            else out[column.key] = cell;
          }
          return out;
        });
        break;
      default:
        next = trimmed(value);
    }
    setPath(item, field.key, next);
  }
  return { item: schema.finalize ? schema.finalize(item) : item, uploads };
}

/** The top-level profile fields a profile form edits, e.g. name, title and languages for "basics". */
export function profileFields(schema: FormSchema, item: Values): Partial<Profile> {
  const keys = [...new Set(schema.fields.map((field) => field.key.split('.')[0]))];
  return Object.fromEntries(keys.map((key) => [key, item[key]])) as Partial<Profile>;
}
```

- [ ] **Step 3：运行测试，确认通过**

Run: `npx vitest run editor/schemas.test.ts && npx tsc`
Expected: `13 passed`；`tsc` 无输出。

- [ ] **Step 4：提交**

```bash
git add editor/schemas.ts editor/schemas.test.ts
git commit -m "feat: describe edit forms and convert between forms and content

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8：编辑弹窗与管理栏组件

**Files:**
- Create: `editor/components/Modal.tsx`、`editor/components/fields.tsx`、`editor/components/ItemModal.tsx`、`editor/components/ReorderModal.tsx`、`editor/components/AdminBar.tsx`

**Interfaces:**
- Consumes：Task 2–7 的全部导出。
- Produces：
  - 通用弹窗：`Modal({ title, onClose, footer, children })`、`BUTTON_PRIMARY`、`BUTTON_SECONDARY`。
  - 表单字段：`FieldControl({ field, value, error, onChange })`。
  - 编辑弹窗：`SaveHandler = (op, uploads, message) => Promise<void>`、`FormRequest`、`ItemModal({ request, content, onSave, onClose })`。
  - 排序弹窗：`ReorderModal({ collection, category?, content, onSave, onClose })`。
  - 管理栏：`LoadState`、`AdminBar({ session, enabled, onToggle, loadState, deploy, onLogout })`。

这些组件的行为在 Task 10 的浏览器验证中检查，本任务只需要通过类型检查。

- [ ] **Step 1：创建 `editor/components/Modal.tsx`**

```tsx file=editor/components/Modal.tsx
import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export const BUTTON_PRIMARY =
  'inline-flex items-center gap-1 px-4 py-2 rounded-md bg-gray-900 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50';
export const BUTTON_SECONDARY =
  'inline-flex items-center gap-1 px-4 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50';

interface ModalProps {
  title: string;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}

/** Full screen on phones, a centred dialog elsewhere. Escape and the backdrop call onClose. */
export const Modal: React.FC<ModalProps> = ({ title, onClose, footer, children }) => {
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-stretch sm:items-center justify-center bg-black/40 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close.current();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex flex-col w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-xl bg-white sm:rounded-xl shadow-xl"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={() => close.current()}
            aria-label="关闭"
            className="p-1 text-gray-400 hover:text-gray-700"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-100">{footer}</div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2：创建 `editor/components/fields.tsx`**

```tsx file=editor/components/fields.tsx
import React, { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from 'lucide-react';
import { resolveImage } from '../../lib/localImages';
import { isPendingImage, prepareImage, validateImage } from '../images';
import { Column, Field, Option, Values } from '../schemas';
import { BUTTON_SECONDARY } from './Modal';

const INPUT =
  'w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm text-gray-900 focus:outline-none focus:border-purple-500';
const TEXTAREA_ROWS: Record<string, number> = { textarea: 3, markdown: 3, lines: 5, paragraphs: 10 };

const SelectInput: React.FC<{
  id?: string;
  value: unknown;
  options: Option[];
  required?: boolean;
  onChange: (value: string) => void;
}> = ({ id, value, options, required, onChange }) => {
  const current = typeof value === 'string' ? value : '';
  return (
    <select id={id} className={INPUT} value={current} onChange={(event) => onChange(event.target.value)}>
      {(!required || current === '') && <option value="">{required ? '请选择' : '（无）'}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

const ImageInput: React.FC<{ value: unknown; onChange: (value: unknown) => void; compact?: boolean }> = ({
  value,
  onChange,
  compact = false,
}) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const src = isPendingImage(value) ? value.previewUrl : resolveImage(typeof value === 'string' ? value : '');

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const problem = validateImage(file);
    setError(problem);
    if (problem) return;
    setBusy(true);
    try {
      onChange(await prepareImage(file));
    } catch {
      setError('图片处理失败，请换一张试试');
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <div
          className={`${compact ? 'w-10 h-10' : 'w-24 h-16'} flex-shrink-0 flex items-center justify-center overflow-hidden rounded-md border border-dashed border-gray-300 bg-gray-50`}
        >
          {src ? <img src={src} alt="" className="w-full h-full object-contain" /> : <ImagePlus size={16} className="text-gray-300" />}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
          className={`${BUTTON_SECONDARY} ${compact ? '!px-2 !py-1 !text-xs' : ''}`}
        >
          {busy ? '处理中…' : src ? '更换' : '上传图片'}
        </button>
        {src && !busy && (
          <button type="button" onClick={() => onChange('')} className="text-xs text-gray-500 hover:text-red-600">
            移除
          </button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(event) => {
            void pick(event.target.files?.[0]);
          }}
        />
      </div>
      {!compact && <p className="mt-1 text-xs text-gray-400">PNG、JPG、WebP 或 GIF，最大 5MB；超过 1600 像素会自动缩小</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};

const CellInput: React.FC<{ column: Column; value: unknown; onChange: (value: unknown) => void }> = ({
  column,
  value,
  onChange,
}) => {
  if (column.type === 'image') return <ImageInput value={value} onChange={onChange} compact />;
  if (column.type === 'select') {
    return <SelectInput value={value} options={column.options ?? []} required={column.required} onChange={onChange} />;
  }
  return (
    <input
      aria-label={column.label}
      className={INPUT}
      placeholder={column.placeholder ?? column.label}
      value={typeof value === 'string' ? value : ''}
      onChange={(event) => onChange(event.target.value)}
    />
  );
};

const IconButton: React.FC<{ label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }> = ({
  label,
  disabled,
  onClick,
  children,
}) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className="p-1 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
  >
    {children}
  </button>
);

const RowsInput: React.FC<{ field: Field; value: unknown; onChange: (value: unknown) => void }> = ({
  field,
  value,
  onChange,
}) => {
  const rows = Array.isArray(value) ? (value as Values[]) : [];
  const columns = field.columns ?? [];
  const update = (index: number, key: string, cell: unknown) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, [key]: cell } : row)));
  const move = (index: number, delta: number) => {
    const next = [...rows];
    const [row] = next.splice(index, 1);
    next.splice(index + delta, 0, row);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={index} className="flex items-start gap-2 p-2 rounded-md border border-gray-200">
          <div className={`flex-1 grid gap-2 ${columns.length > 2 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            {columns.map((column) => (
              <CellInput
                key={column.key}
                column={column}
                value={row[column.key]}
                onChange={(cell) => update(index, column.key, cell)}
              />
            ))}
          </div>
          <div className="flex flex-col">
            <IconButton label="上移" disabled={index === 0} onClick={() => move(index, -1)}>
              <ArrowUp size={14} />
            </IconButton>
            <IconButton label="下移" disabled={index === rows.length - 1} onClick={() => move(index, 1)}>
              <ArrowDown size={14} />
            </IconButton>
            <IconButton label="删除这一行" onClick={() => onChange(rows.filter((_, i) => i !== index))}>
              <Trash2 size={14} />
            </IconButton>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, {}])}
        className="text-xs font-medium text-purple-600 hover:underline"
      >
        + {field.addLabel ?? '添加一行'}
      </button>
    </div>
  );
};

export const FieldControl: React.FC<{
  field: Field;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
}> = ({ field, value, error, onChange }) => {
  const id = `field-${field.key.replace(/\W/g, '-')}`;
  const textValue = typeof value === 'string' ? value : '';
  let control: React.ReactNode;
  switch (field.type) {
    case 'select':
      control = (
        <SelectInput id={id} value={value} options={field.options ?? []} required={field.required} onChange={onChange} />
      );
      break;
    case 'image':
      control = <ImageInput value={value} onChange={onChange} />;
      break;
    case 'rows':
      control = <RowsInput field={field} value={value} onChange={onChange} />;
      break;
    case 'textarea':
    case 'markdown':
    case 'lines':
    case 'paragraphs':
      control = (
        <textarea
          id={id}
          className={`${INPUT} leading-relaxed`}
          rows={TEXTAREA_ROWS[field.type]}
          placeholder={field.placeholder}
          value={textValue}
          onChange={(event) => onChange(event.target.value)}
        />
      );
      break;
    default:
      control = (
        <input
          id={id}
          className={INPUT}
          inputMode={field.type === 'year' ? 'numeric' : undefined}
          maxLength={field.type === 'year' ? 4 : undefined}
          placeholder={field.placeholder}
          value={textValue}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }

  return (
    <div className="mb-4">
      <label htmlFor={id} className="block mb-1 text-xs font-medium text-gray-600">
        {field.label}
        {field.required && <span className="text-red-500"> *</span>}
      </label>
      {control}
      {field.help && <p className="mt-1 text-xs text-gray-400">{field.help}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};
```

- [ ] **Step 3：创建 `editor/components/ItemModal.tsx`**

```tsx file=editor/components/ItemModal.tsx
import React, { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { EditRequest, SiteContent } from '../../types';
import { ImageUpload, describeSaveError } from '../backend';
import { ContentOp, ListItem, commitMessage, itemNoun } from '../ops';
import {
  FormSchema,
  FormState,
  LIST_SCHEMAS,
  PROFILE_SCHEMAS,
  Values,
  fromFormState,
  newItem,
  profileFields,
  toFormState,
  validateForm,
  visibleFields,
} from '../schemas';
import { FieldControl } from './fields';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, Modal } from './Modal';

export type SaveHandler = (op: ContentOp, uploads: ImageUpload[], message: string) => Promise<void>;

export type FormRequest = Exclude<EditRequest, { kind: 'reorder' }>;

interface ResolvedForm {
  schema: FormSchema;
  item: Values;
  title: string;
  isNew: boolean;
}

function resolveForm(request: FormRequest, content: SiteContent): ResolvedForm | null {
  if (request.kind === 'profile') {
    const schema = PROFILE_SCHEMAS[request.section];
    return { schema, item: content.profile as unknown as Values, title: schema.editTitle, isNew: false };
  }
  const schema = LIST_SCHEMAS[request.collection];
  if (request.kind === 'add') {
    return { schema, item: newItem(request.collection, request.preset), title: schema.addTitle, isNew: true };
  }
  const item = (content[request.collection] as unknown as Values[]).find((entry) => entry.id === request.id);
  return item ? { schema, item, title: schema.editTitle, isNew: false } : null;
}

interface Props {
  request: FormRequest;
  content: SiteContent;
  onSave: SaveHandler;
  onClose: () => void;
}

export const ItemModal: React.FC<Props> = ({ request, content, onSave, onClose }) => {
  // Resolved once: the form edits the item as it was when the dialog opened.
  const [form] = useState(() => resolveForm(request, content));
  const initial = useMemo(() => (form ? toFormState(form.schema, form.item) : {}), [form]);
  const [state, setState] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!form) {
    return (
      <Modal
        title="找不到这一条"
        onClose={onClose}
        footer={
          <button type="button" className={`${BUTTON_SECONDARY} ml-auto`} onClick={onClose}>
            关闭
          </button>
        }
      >
        <p className="text-sm text-gray-600">这一条可能已经在别处被删除了，刷新页面可以看到最新内容。</p>
      </Modal>
    );
  }

  const dirty = JSON.stringify(state) !== JSON.stringify(initial);

  const close = () => {
    if (saving) return;
    if (dirty && !window.confirm('放弃未保存的修改？')) return;
    onClose();
  };

  const submit = async (op: ContentOp, uploads: ImageUpload[], message: string) => {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(op, uploads, message);
      onClose();
    } catch (error) {
      setSaveError(describeSaveError(error));
      setSaving(false);
    }
  };

  const save = () => {
    const found = validateForm(form.schema, state);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const { item, uploads } = fromFormState(form.schema, state, form.item, new Date());
    if (request.kind === 'profile') {
      void submit(
        { kind: 'patchProfile', collection: 'profile', fields: profileFields(form.schema, item) },
        uploads,
        commitMessage('update', `profile ${request.section}`),
      );
    } else {
      void submit(
        { kind: 'upsert', collection: request.collection, item: item as ListItem },
        uploads,
        commitMessage(form.isNew ? 'add' : 'update', itemNoun(request.collection), form.schema.label(item)),
      );
    }
  };

  const remove = () => {
    if (request.kind !== 'edit') return;
    if (!window.confirm('确定删除这一条吗？删除后会立即发布。')) return;
    void submit(
      { kind: 'delete', collection: request.collection, id: request.id },
      [],
      commitMessage('delete', itemNoun(request.collection), form.schema.label(form.item)),
    );
  };

  const setField = (key: string, value: unknown) => {
    setState((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  return (
    <Modal
      title={form.title}
      onClose={close}
      footer={
        <>
          {request.kind === 'edit' && (
            <button
              type="button"
              disabled={saving}
              onClick={remove}
              className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              <Trash2 size={14} />
              删除
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button type="button" disabled={saving} onClick={close} className={BUTTON_SECONDARY}>
              取消
            </button>
            <button type="button" disabled={saving} onClick={save} className={BUTTON_PRIMARY}>
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </>
      }
    >
      {saveError && (
        <div role="alert" className="mb-4 p-3 rounded-md bg-red-50 text-sm text-red-700">
          {saveError}
        </div>
      )}
      {visibleFields(form.schema, state).map((field) => (
        <FieldControl
          key={field.key}
          field={field}
          value={state[field.key]}
          error={errors[field.key]}
          onChange={(value) => setField(field.key, value)}
        />
      ))}
      <p className="text-xs text-gray-400">保存后会立即提交到 GitHub，网站约 1 分钟后更新。</p>
    </Modal>
  );
};
```

- [ ] **Step 4：创建 `editor/components/ReorderModal.tsx`**

```tsx file=editor/components/ReorderModal.tsx
import React, { useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { ExperienceCategory, ListCollection, SiteContent } from '../../types';
import { describeSaveError } from '../backend';
import { commitMessage } from '../ops';
import { LIST_SCHEMAS, Values } from '../schemas';
import { SaveHandler } from './ItemModal';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, Modal } from './Modal';

const SECTION_NAMES: Record<string, string> = {
  news: '新闻',
  talks: '报告',
  education: '教育经历',
  work: '工作经历',
  volunteer: '志愿与服务',
};

interface Props {
  collection: ListCollection;
  category?: ExperienceCategory;
  content: SiteContent;
  onSave: SaveHandler;
  onClose: () => void;
}

export const ReorderModal: React.FC<Props> = ({ collection, category, content, onSave, onClose }) => {
  const schema = LIST_SCHEMAS[collection];
  const [items] = useState(() =>
    (content[collection] as unknown as Values[]).filter((item) => !category || item.category === category),
  );
  const [order, setOrder] = useState(() => items.map((item) => String(item.id)));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const byId = new Map(items.map((item) => [String(item.id), item]));
  const dirty = order.join() !== items.map((item) => String(item.id)).join();

  const move = (index: number, delta: number) => {
    setOrder((current) => {
      const next = [...current];
      const [id] = next.splice(index, 1);
      next.splice(index + delta, 0, id);
      return next;
    });
  };

  const close = () => {
    if (saving) return;
    if (dirty && !window.confirm('放弃未保存的修改？')) return;
    onClose();
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(
        { kind: 'reorder', collection, ids: order },
        [],
        commitMessage('reorder', category ? `${collection} (${category})` : collection),
      );
      onClose();
    } catch (error) {
      setSaveError(describeSaveError(error));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`调整顺序 · ${SECTION_NAMES[category ?? collection] ?? collection}`}
      onClose={close}
      footer={
        <div className="ml-auto flex items-center gap-2">
          <button type="button" disabled={saving} onClick={close} className={BUTTON_SECONDARY}>
            取消
          </button>
          <button type="button" disabled={saving || !dirty} onClick={() => void save()} className={BUTTON_PRIMARY}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      }
    >
      {saveError && (
        <div role="alert" className="mb-4 p-3 rounded-md bg-red-50 text-sm text-red-700">
          {saveError}
        </div>
      )}
      <ol className="divide-y divide-gray-100 rounded-md border border-gray-200">
        {order.map((id, index) => (
          <li key={id} className="flex items-center gap-3 px-3 py-2">
            <span className="w-5 text-xs text-gray-400">{index + 1}</span>
            <span className="flex-1 text-sm text-gray-800 line-clamp-2">{schema.label(byId.get(id) ?? {})}</span>
            <button
              type="button"
              aria-label="上移"
              disabled={index === 0}
              onClick={() => move(index, -1)}
              className="p-1 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30"
            >
              <ArrowUp size={16} />
            </button>
            <button
              type="button"
              aria-label="下移"
              disabled={index === order.length - 1}
              onClick={() => move(index, 1)}
              className="p-1 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30"
            >
              <ArrowDown size={16} />
            </button>
          </li>
        ))}
      </ol>
    </Modal>
  );
};
```

- [ ] **Step 5：创建 `editor/components/AdminBar.tsx`**

```tsx file=editor/components/AdminBar.tsx
import React from 'react';
import { ExternalLink, Loader2, LogOut } from 'lucide-react';
import { Session } from '../../lib/session';
import { DeployStatus } from '../backend';

export type LoadState = 'loading' | 'ready' | 'error';

const Status: React.FC<{ loadState: LoadState; deploy: DeployStatus | null }> = ({ loadState, deploy }) => {
  if (loadState === 'loading') {
    return (
      <span className="flex items-center gap-1 text-gray-400">
        <Loader2 size={12} className="animate-spin" />
        正在读取最新内容…
      </span>
    );
  }
  if (loadState === 'error') return <span className="text-red-400">读取最新内容失败，请刷新页面重试</span>;
  if (!deploy) return null;
  if (deploy.state === 'pending') {
    return (
      <span className="flex items-center gap-1 text-amber-300">
        <Loader2 size={12} className="animate-spin" />
        已保存，正在部署…
      </span>
    );
  }
  if (deploy.state === 'success') return <span className="text-emerald-400">已上线</span>;
  const message = deploy.state === 'failure' ? '部署失败' : '部署状态未知';
  return deploy.url ? (
    <a href={deploy.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-red-400 hover:underline">
      {message}，查看日志
      <ExternalLink size={12} />
    </a>
  ) : (
    <span className="text-red-400">{message}</span>
  );
};

interface Props {
  session: Session;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  loadState: LoadState;
  deploy: DeployStatus | null;
  onLogout: () => void;
}

export const AdminBar: React.FC<Props> = ({ session, enabled, onToggle, loadState, deploy, onLogout }) => (
  <div className="bg-gray-900 text-xs text-gray-300">
    <div className="max-w-5xl mx-auto px-6 md:px-12 py-2 flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="flex items-center gap-2">
        {session.avatarUrl ? (
          <img src={session.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
        ) : (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-600 text-[10px] font-semibold text-white">
            {session.login.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="font-medium text-white">{session.login}</span>
      </span>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onToggle(!enabled)}
          className={`relative w-8 h-4 rounded-full transition-colors ${enabled ? 'bg-purple-500' : 'bg-gray-600'}`}
        >
          <span
            className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${enabled ? 'left-[18px]' : 'left-0.5'}`}
          />
        </button>
        编辑模式
      </label>
      <span className="ml-auto">
        <Status loadState={loadState} deploy={deploy} />
      </span>
      <button type="button" onClick={onLogout} className="flex items-center gap-1 text-gray-400 hover:text-white">
        <LogOut size={12} />
        退出
      </button>
    </div>
  </div>
);
```

- [ ] **Step 6：类型检查并提交**

Run: `npx tsc && npm test`
Expected: `tsc` 无输出；全部测试通过。

```bash
git add editor/components
git commit -m "feat: add edit dialogs, form fields and the admin bar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9：接入页面

**Files:**
- Modify: `components/ContentContext.tsx`（整体替换）
- Create: `components/EditMode.tsx`、`editor/EditorRoot.tsx`
- Modify（整体替换）: `components/Footer.tsx`、`App.tsx`、`index.tsx`
- Modify: `components/ListItem.tsx`、`views/About.tsx`、`views/Experiences.tsx`、`views/Publications.tsx`、`views/Projects.tsx`、`views/Awards.tsx`、`views/Talks.tsx`

**Interfaces:**
- Consumes：Task 2–8 的全部导出。
- Produces：
  - `components/ContentContext.tsx`：`ContentProvider`、`useUpdateContent()`。
  - `components/EditMode.tsx`：`EditModeContext`、`EditModeValue`、`useEditMode()`、`EditModeProvider({ loginCallback })`、`Toast`、`EditButton`、`AddButton`、`ReorderButton`。
  - `editor/EditorRoot.tsx`：默认导出 `EditorRoot({ session, onLogout, children })`。

- [ ] **Step 1：用下面的内容替换 `components/ContentContext.tsx`**

```tsx file=components/ContentContext.tsx
import React, { createContext, useContext, useState } from 'react';
import { bundledContent } from '../content';
import { SiteContent } from '../types';

// Visitors see the bundled content. The edit mode provides fresher content through this context.
export const ContentContext = createContext<SiteContent>(bundledContent);

const ContentUpdateContext = createContext<React.Dispatch<React.SetStateAction<SiteContent>>>(() => {});

export const ContentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [content, setContent] = useState(bundledContent);
  return (
    <ContentUpdateContext.Provider value={setContent}>
      <ContentContext.Provider value={content}>{children}</ContentContext.Provider>
    </ContentUpdateContext.Provider>
  );
};

export const useContent = (): SiteContent => useContext(ContentContext);

/** Lets the edit mode replace the content after loading or saving. */
export const useUpdateContent = (): React.Dispatch<React.SetStateAction<SiteContent>> => useContext(ContentUpdateContext);
```

- [ ] **Step 2：创建 `components/EditMode.tsx`**

```tsx file=components/EditMode.tsx
import React, { Suspense, createContext, lazy, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, Pencil, Plus, X } from 'lucide-react';
import { loginConfigured } from '../editor/config';
import { LoginCallback, MOCK_MODE, Session, loadSession } from '../lib/session';
import { EditRequest } from '../types';

export interface EditModeValue {
  /** True when the owner is signed in, the latest content has loaded and the edit switch is on. */
  editing: boolean;
  loggedIn: boolean;
  /** Whether to offer the login entry at all. */
  canLogin: boolean;
  open: (request: EditRequest) => void;
  login: () => void;
}

const noop = (): void => {};

export const EditModeContext = createContext<EditModeValue>({
  editing: false,
  loggedIn: false,
  canLogin: false,
  open: noop,
  login: noop,
});

export const useEditMode = (): EditModeValue => useContext(EditModeContext);

// Loaded only once the owner signs in, so visitors never download the editor.
const EditorRoot = lazy(() => import('../editor/EditorRoot'));

export const Toast: React.FC<{
  message: string;
  onClose: () => void;
  action?: { label: string; onClick: () => void };
}> = ({ message, onClose, action }) => {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const timer = setTimeout(() => close.current(), 6000);
    return () => clearTimeout(timer);
  }, [message]);
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-3 w-max max-w-[90vw] px-4 py-3 rounded-lg bg-gray-900 text-sm text-white shadow-lg"
    >
      <span>{message}</span>
      {action && (
        <button type="button" onClick={action.onClick} className="shrink-0 font-medium text-purple-300 hover:text-purple-200">
          {action.label}
        </button>
      )}
      <button type="button" onClick={onClose} aria-label="关闭" className="shrink-0 text-gray-400 hover:text-white">
        <X size={14} />
      </button>
    </div>
  );
};

export const EditModeProvider: React.FC<{ loginCallback: LoginCallback | null; children: React.ReactNode }> = ({
  loginCallback,
  children,
}) => {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [toast, setToast] = useState<string | null>(null);
  const handledCallback = useRef(false);

  useEffect(() => {
    // The code is single-use, so StrictMode's second effect run must not exchange it again.
    if (!loginCallback || handledCallback.current) return;
    handledCallback.current = true;
    import('../editor/auth')
      .then(({ completeLogin }) => completeLogin(loginCallback))
      .then(setSession)
      .catch((error: unknown) => setToast(error instanceof Error ? error.message : '登录失败，请重新登录'));
  }, [loginCallback]);

  const login = useCallback(() => {
    import('../editor/auth')
      .then(({ startLogin }) => startLogin())
      .then((started) => {
        if (started) setSession(started);
      })
      .catch(() => setToast('无法开始登录，请稍后重试'));
  }, []);

  const handleLogout = useCallback((message?: string) => {
    setSession(null);
    if (message) setToast(message);
  }, []);

  const visitor = useMemo<EditModeValue>(
    () => ({ editing: false, loggedIn: false, canLogin: MOCK_MODE || loginConfigured(), open: noop, login }),
    [login],
  );
  const page = <EditModeContext.Provider value={visitor}>{children}</EditModeContext.Provider>;

  return (
    <>
      {session ? (
        <Suspense fallback={page}>
          <EditorRoot session={session} onLogout={handleLogout}>
            {children}
          </EditorRoot>
        </Suspense>
      ) : (
        page
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </>
  );
};

const PILL =
  'inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-purple-200 bg-white text-xs font-medium normal-case tracking-normal text-purple-700 hover:bg-purple-50 align-middle';
const ROUND =
  'inline-flex items-center justify-center w-8 h-8 rounded-full border border-gray-300 bg-white text-gray-600 shadow-sm hover:border-purple-300 hover:text-purple-700';

/** A pencil that opens an edit dialog; renders nothing outside edit mode. With `text` it becomes a labelled pill. */
export const EditButton: React.FC<{ request: EditRequest; label: string; text?: string; className?: string }> = ({
  request,
  label,
  text,
  className = '',
}) => {
  const { editing, open } = useEditMode();
  if (!editing) return null;
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => open(request)}
      className={`${text ? PILL : ROUND} ${className}`}
    >
      <Pencil size={14} />
      {text}
    </button>
  );
};

export const AddButton: React.FC<{ request: EditRequest; text: string; className?: string }> = ({
  request,
  text,
  className = '',
}) => {
  const { editing, open } = useEditMode();
  if (!editing) return null;
  return (
    <button type="button" onClick={() => open(request)} className={`${PILL} ${className}`}>
      <Plus size={14} />
      {text}
    </button>
  );
};

export const ReorderButton: React.FC<{ request: EditRequest; className?: string }> = ({ request, className = '' }) => {
  const { editing, open } = useEditMode();
  if (!editing) return null;
  return (
    <button type="button" onClick={() => open(request)} className={`${PILL} ${className}`}>
      <ArrowUpDown size={14} />
      排序
    </button>
  );
};
```

- [ ] **Step 3：创建 `editor/EditorRoot.tsx`**

```tsx file=editor/EditorRoot.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useContent, useUpdateContent } from '../components/ContentContext';
import { EditModeContext, EditModeValue, Toast } from '../components/EditMode';
import { registerLocalImage } from '../lib/localImages';
import { Session, clearSession, isExpiringSoon } from '../lib/session';
import { EditRequest } from '../types';
import { logout, startLogin } from './auth';
import { DeployStatus, EditorBackend, ImageUpload, createBackend } from './backend';
import { GitHubError } from './github';
import { publicUrl } from './images';
import { ContentOp } from './ops';
import { AdminBar, LoadState } from './components/AdminBar';
import { ItemModal } from './components/ItemModal';
import { ReorderModal } from './components/ReorderModal';

const FIRST_POLL_MS = 5_000;
const POLL_MS = 10_000;
const POLL_LIMIT_MS = 10 * 60_000;

interface Props {
  session: Session;
  onLogout: (message?: string) => void;
  children: React.ReactNode;
}

const EditorRoot: React.FC<Props> = ({ session, onLogout, children }) => {
  const content = useContent();
  const setContent = useUpdateContent();
  const [backend, setBackend] = useState<EditorBackend | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [enabled, setEnabled] = useState(true);
  const [request, setRequest] = useState<EditRequest | null>(null);
  const [deploy, setDeploy] = useState<{ sha: string; status: DeployStatus } | null>(null);
  const [toast, setToast] = useState<{ message: string; relogin?: boolean } | null>(null);
  const logoutRef = useRef(onLogout);
  logoutRef.current = onLogout;

  // Swap the bundled content for the latest version on GitHub: the last deployment may still be running.
  useEffect(() => {
    let cancelled = false;
    createBackend(session)
      .then(async (created) => {
        const fresh = await created.load();
        if (cancelled) return;
        setContent(fresh);
        setBackend(created);
        setLoadState('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof GitHubError && error.status === 401) {
          clearSession();
          logoutRef.current('登录已失效，请重新登录');
          return;
        }
        setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [session, setContent]);

  // Follow the deployment of the latest save until it finishes.
  useEffect(() => {
    if (!backend || !deploy || deploy.status.state !== 'pending') return;
    const { sha } = deploy;
    const startedAt = Date.now();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const status = await backend.deployStatus(sha);
        if (stopped) return;
        if (status.state !== 'pending') {
          setDeploy({ sha, status });
          return;
        }
      } catch {
        // Try again on the next tick.
      }
      if (stopped) return;
      if (Date.now() - startedAt > POLL_LIMIT_MS) {
        setDeploy({ sha, status: { state: 'unknown' } });
        return;
      }
      timer = setTimeout(() => void poll(), POLL_MS);
    };
    timer = setTimeout(() => void poll(), FIRST_POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [backend, deploy]);

  const relogin = useCallback(() => {
    void startLogin();
  }, []);

  const open = useCallback(
    (next: EditRequest) => {
      if (isExpiringSoon(session)) {
        setToast({ message: '登录即将过期，请重新登录后再编辑', relogin: true });
        return;
      }
      setRequest(next);
    },
    [session],
  );

  const save = useCallback(
    async (op: ContentOp, uploads: ImageUpload[], message: string) => {
      if (!backend) throw new Error('编辑器还在加载，请稍后再试');
      const result = await backend.save(op, uploads, message, content);
      uploads.forEach((upload) => registerLocalImage(publicUrl(upload.path), upload.previewUrl));
      setContent(result.content);
      setDeploy({ sha: result.commitSha, status: { state: 'pending' } });
    },
    [backend, content, setContent],
  );

  const handleLogout = useCallback(() => {
    void logout(session).finally(() => logoutRef.current());
  }, [session]);

  const closeDialog = useCallback(() => setRequest(null), []);

  const value = useMemo<EditModeValue>(
    () => ({ editing: enabled && loadState === 'ready', loggedIn: true, canLogin: true, open, login: relogin }),
    [enabled, loadState, open, relogin],
  );

  return (
    <EditModeContext.Provider value={value}>
      <AdminBar
        session={session}
        enabled={enabled}
        onToggle={setEnabled}
        loadState={loadState}
        deploy={deploy?.status ?? null}
        onLogout={handleLogout}
      />
      {children}
      {request?.kind === 'reorder' && (
        <ReorderModal
          collection={request.collection}
          category={request.category}
          content={content}
          onSave={save}
          onClose={closeDialog}
        />
      )}
      {request && request.kind !== 'reorder' && (
        <ItemModal request={request} content={content} onSave={save} onClose={closeDialog} />
      )}
      {toast && (
        <Toast
          message={toast.message}
          onClose={() => setToast(null)}
          action={toast.relogin ? { label: '重新登录', onClick: relogin } : undefined}
        />
      )}
    </EditModeContext.Provider>
  );
};

export default EditorRoot;
```

- [ ] **Step 4：替换 `components/Footer.tsx`、`App.tsx`、`index.tsx`**

```tsx file=components/Footer.tsx
import React from 'react';
import { Lock } from 'lucide-react';
import { useEditMode } from './EditMode';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const { canLogin, loggedIn, login } = useEditMode();
  return (
    <footer className="w-full bg-gray-900 text-gray-400 py-6 text-center text-xs mt-20">
      <p>
        © Copyright {currentYear} Zihan ZHAO. Powered by React. Hosted by GitHub Pages.
        {canLogin && !loggedIn && (
          <button
            type="button"
            onClick={login}
            title="管理员登录"
            aria-label="管理员登录"
            className="ml-2 align-middle text-gray-600 hover:text-gray-300 transition-colors"
          >
            <Lock size={11} />
          </button>
        )}
      </p>
    </footer>
  );
};

export default Footer;
```

```tsx file=App.tsx
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { ContentProvider } from './components/ContentContext';
import { EditModeProvider } from './components/EditMode';
import { LoginCallback } from './lib/session';
import About from './views/About';
import Publications from './views/Publications';
import Projects from './views/Projects';
import Talks from './views/Talks';
import Awards from './views/Awards';
import Experiences from './views/Experiences';
import CV from './views/CV';

const App: React.FC<{ loginCallback: LoginCallback | null }> = ({ loginCallback }) => {
  return (
    <ContentProvider>
      <EditModeProvider loginCallback={loginCallback}>
        <HashRouter>
          <div className="min-h-screen flex flex-col bg-white">
            <Navbar />
            <main className="flex-grow w-full max-w-5xl mx-auto px-6 md:px-12">
              <Routes>
                <Route path="/" element={<About />} />
                <Route path="/experiences" element={<Experiences />} />
                <Route path="/publications" element={<Publications />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/talks" element={<Talks />} />
                <Route path="/awards" element={<Awards />} />
                <Route path="/cv" element={<CV />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </HashRouter>
      </EditModeProvider>
    </ContentProvider>
  );
};

export default App;
```

```tsx file=index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { takeLoginCallback } from './lib/session';

// Read GitHub's login redirect before the router looks at the address bar.
const loginCallback = takeLoginCallback();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App loginCallback={loginCallback} />
  </React.StrictMode>
);
```

- [ ] **Step 5：`components/ListItem.tsx` 接入编辑按钮和本地预览**

把

```tsx
import React from 'react';
```

替换为

```tsx
import React from 'react';
import { EditButton } from './EditMode';
import { resolveImage } from '../lib/localImages';
import { EditRequest } from '../types';
```

把

```tsx
  sideContent?: React.ReactNode; // e.g. Year displayed on the side
}
```

替换为

```tsx
  sideContent?: React.ReactNode; // e.g. Year displayed on the side
  editRequest?: EditRequest; // Shows a pencil in edit mode
}
```

把

```tsx
  tags,
  sideContent
}) => {
```

替换为

```tsx
  tags,
  sideContent,
  editRequest
}) => {
```

把

```tsx
          <img src={image} alt="thumbnail" className="w-full h-full object-contain p-2" />
```

替换为

```tsx
          <img src={resolveImage(image)} alt="thumbnail" className="w-full h-full object-contain p-2" />
```

把

```tsx
        <h3 className="text-lg font-bold text-gray-900 leading-tight mb-2">
          {title}
        </h3>
```

替换为

```tsx
        <h3 className="text-lg font-bold text-gray-900 leading-tight mb-2">
          {editRequest && <EditButton request={editRequest} label="编辑" className="float-right ml-3" />}
          {title}
        </h3>
```

- [ ] **Step 6：`views/About.tsx` 接入编辑按钮**

把

```tsx
import { Icon } from '../components/Icon';
import { renderInlineMarkdown } from '../lib/markdown';
```

替换为

```tsx
import { AddButton, EditButton, ReorderButton } from '../components/EditMode';
import { Icon } from '../components/Icon';
import { resolveImage } from '../lib/localImages';
import { renderInlineMarkdown } from '../lib/markdown';
```

把

```tsx
          {profile.name.first} <span className="font-light">{profile.name.last}</span>
        </h1>
```

替换为

```tsx
          {profile.name.first} <span className="font-light">{profile.name.last}</span>
          <EditButton request={{ kind: 'profile', section: 'basics' }} label="编辑基本信息" className="ml-3 align-middle" />
        </h1>
```

把

```tsx
          <div className="text-gray-700 space-y-4 text-justify font-light mb-8">
            {profile.bio.map((paragraph, idx) => (
```

替换为

```tsx
          <div className="text-gray-700 space-y-4 text-justify font-light mb-8">
            <EditButton request={{ kind: 'profile', section: 'bio' }} label="编辑简介" className="float-right ml-3" />
            {profile.bio.map((paragraph, idx) => (
```

把

```tsx
              src={profile.avatar}
```

替换为

```tsx
              src={resolveImage(profile.avatar)}
```

把

```tsx
              className="relative w-full h-auto rounded-lg shadow-lg object-cover transition-all duration-500"
            />
          </div>
```

替换为

```tsx
              className="relative w-full h-auto rounded-lg shadow-lg object-cover transition-all duration-500"
            />
            <EditButton
              request={{ kind: 'profile', section: 'avatar' }}
              label="更换头像"
              text="更换照片"
              className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 shadow"
            />
          </div>
```

把

```tsx
                        src={social.qrCode}
```

替换为

```tsx
                        src={resolveImage(social.qrCode)}
```

把

```tsx
              );
            })}
          </div>
        </div>
      </div>
```

替换为

```tsx
              );
            })}
            <EditButton request={{ kind: 'profile', section: 'socials' }} label="编辑联系方式" />
          </div>
        </div>
      </div>
```

把

```tsx
        <h2 className="text-2xl font-light text-gray-900 mb-6">news</h2>
```

替换为

```tsx
        <h2 className="text-2xl font-light text-gray-900 mb-6">
          news
          <AddButton request={{ kind: 'add', collection: 'news' }} text="添加新闻" className="ml-3" />
          <ReorderButton request={{ kind: 'reorder', collection: 'news' }} className="ml-2" />
        </h2>
```

把

```tsx
              <div className="text-gray-600" dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(item.content) }} />
```

替换为

```tsx
              <div className="text-gray-600" dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(item.content) }} />
              <EditButton
                request={{ kind: 'edit', collection: 'news', id: item.id }}
                label="编辑这条新闻"
                className="flex-shrink-0 sm:ml-auto"
              />
```

- [ ] **Step 7：`views/Experiences.tsx` 接入编辑按钮**

把

```tsx
import { useContent } from '../components/ContentContext';
```

替换为

```tsx
import { useContent } from '../components/ContentContext';
import { AddButton, ReorderButton } from '../components/EditMode';
```

把

```tsx
const SECTIONS: { id: ExperienceCategory; title: string }[] = [
  { id: 'education', title: 'Education' },
  { id: 'work', title: 'Work Experience' },
  { id: 'volunteer', title: 'Volunteer & Service' },
];
```

替换为

```tsx
const SECTIONS: { id: ExperienceCategory; title: string; addText: string }[] = [
  { id: 'education', title: 'Education', addText: '添加教育经历' },
  { id: 'work', title: 'Work Experience', addText: '添加工作经历' },
  { id: 'volunteer', title: 'Volunteer & Service', addText: '添加志愿经历' },
];
```

把

```tsx
                {section.title}
              </h2>
```

替换为

```tsx
                {section.title}
              </h2>
              <AddButton
                request={{ kind: 'add', collection: 'experiences', preset: { category: section.id } }}
                text={section.addText}
                className="ml-3"
              />
              <ReorderButton request={{ kind: 'reorder', collection: 'experiences', category: section.id }} className="ml-2" />
```

把

```tsx
                  <ListItem
                    key={exp.id}
```

替换为

```tsx
                  <ListItem
                    key={exp.id}
                    editRequest={{ kind: 'edit', collection: 'experiences', id: exp.id }}
```

- [ ] **Step 8：`views/Publications.tsx`、`views/Projects.tsx`、`views/Awards.tsx` 接入编辑按钮**

`views/Publications.tsx`：把

```tsx
import { useContent } from '../components/ContentContext';
```

替换为

```tsx
import { useContent } from '../components/ContentContext';
import { AddButton } from '../components/EditMode';
```

把

```tsx
        <h1 className="text-3xl font-light text-gray-900 mb-2">publications</h1>
```

替换为

```tsx
        <h1 className="text-3xl font-light text-gray-900 mb-2">
          publications
          <AddButton request={{ kind: 'add', collection: 'publications' }} text="添加论文" className="ml-3" />
        </h1>
```

把

```tsx
                        <ListItem
                          key={pub.id}
```

替换为

```tsx
                        <ListItem
                          key={pub.id}
                          editRequest={{ kind: 'edit', collection: 'publications', id: pub.id }}
```

`views/Projects.tsx`：把

```tsx
import { useContent } from '../components/ContentContext';
```

替换为

```tsx
import { useContent } from '../components/ContentContext';
import { AddButton } from '../components/EditMode';
```

把

```tsx
        <h1 className="text-3xl font-light text-gray-900 mb-2">projects</h1>
```

替换为

```tsx
        <h1 className="text-3xl font-light text-gray-900 mb-2">
          projects
          <AddButton request={{ kind: 'add', collection: 'projects' }} text="添加项目" className="ml-3" />
        </h1>
```

把

```tsx
                <ListItem
                  key={proj.id}
```

替换为

```tsx
                <ListItem
                  key={proj.id}
                  editRequest={{ kind: 'edit', collection: 'projects', id: proj.id }}
```

`views/Awards.tsx`：把

```tsx
import { useContent } from '../components/ContentContext';
```

替换为

```tsx
import { useContent } from '../components/ContentContext';
import { AddButton } from '../components/EditMode';
```

把

```tsx
        <h1 className="text-3xl font-light text-gray-900 mb-2">honors & awards</h1>
```

替换为

```tsx
        <h1 className="text-3xl font-light text-gray-900 mb-2">
          honors & awards
          <AddButton request={{ kind: 'add', collection: 'awards' }} text="添加奖项" className="ml-3" />
        </h1>
```

把

```tsx
                  <ListItem
                    key={award.id}
```

替换为

```tsx
                  <ListItem
                    key={award.id}
                    editRequest={{ kind: 'edit', collection: 'awards', id: award.id }}
```

- [ ] **Step 9：`views/Talks.tsx` 接入编辑按钮**

把

```tsx
import { useContent } from '../components/ContentContext';
```

替换为

```tsx
import { useContent } from '../components/ContentContext';
import { AddButton, EditButton, ReorderButton } from '../components/EditMode';
```

把

```tsx
        <h1 className="text-3xl font-light text-gray-900 mb-2">invited talks</h1>
```

替换为

```tsx
        <h1 className="text-3xl font-light text-gray-900 mb-2">
          invited talks
          <AddButton request={{ kind: 'add', collection: 'talks' }} text="添加报告" className="ml-3" />
          <ReorderButton request={{ kind: 'reorder', collection: 'talks' }} className="ml-2" />
        </h1>
```

把

```tsx
            <h3 className="text-xl font-bold text-gray-900 mb-2">{talk.title}</h3>
```

替换为

```tsx
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              <EditButton
                request={{ kind: 'edit', collection: 'talks', id: talk.id }}
                label="编辑这场报告"
                className="float-right ml-3"
              />
              {talk.title}
            </h3>
```

- [ ] **Step 10：检查访客视角零变化，并检查构建产物**

Run: `npm test`
Expected：全部通过，并且 `git status views/__snapshots__` 没有任何改动（编辑按钮在非编辑模式下渲染为空）。

Run:

```bash
npm run build
ls dist/assets/
grep -l "api.github.com" dist/assets/*.js
grep -c "mock-fail\|createMockBackend\|mock commit" dist/assets/*.js
```

Expected：
- 构建通过；
- 除主包 `index-*.js` 外，至少还有一个按需加载的编辑器 chunk；
- `api.github.com` 只出现在编辑器 chunk 里，不出现在主包 `index-*.js` 中；
- 最后一条命令对每个文件都输出 `0`，说明模拟后端没有被打包。

- [ ] **Step 11：提交**

```bash
git add components App.tsx index.tsx views editor/EditorRoot.tsx
git commit -m "feat: add the LinkedIn-style edit mode to every page

The owner signs in from the footer lock; edit buttons render nothing for
visitors and the editor bundle only loads after login.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10：模拟模式下的浏览器验证

**Files:**
- Modify（不提交）：`.claude/launch.json` 加入 `dev-mock` 配置

- [ ] **Step 1：启动模拟模式**

在 `.claude/launch.json` 的 `configurations` 中加入：

```json
{
  "name": "dev-mock",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "dev:mock"],
  "port": 3000
}
```

用 `preview_start`（name: `dev-mock`）打开 `http://localhost:3000/`。

- [ ] **Step 2：逐项验证**

每项都截图确认，并检查控制台没有报错。

1. **访客视角**：页面上没有任何编辑按钮；页脚有锁形图标。
2. **登录**：点锁形图标。
   - 页面顶部出现管理栏（用户名 zihanzhao1022、编辑模式开关、"正在读取最新内容…"），约 0.5 秒后读取完成。
   - 各页面出现铅笔、"添加"和"排序"按钮。
3. **编辑论文**：在 Publications 页点一篇论文的铅笔，弹窗字段正确回填。
   - 改标题后保存：弹窗关闭，页面立即显示新标题。
   - 管理栏依次显示"已保存，正在部署…"和"已上线"（约 15 秒）。
   - 控制台的 `[mock commit]` 日志是 `content: update publication "..."`。
4. **校验**：清空标题后保存，字段下方提示"请填写标题"，弹窗不关闭。
5. **新增与删除新闻**：
   - 在 About 页点"添加新闻"，填写日期和带 `[链接](https://example.com)` 的内容后保存，新闻出现在列表第一条，链接可以点击。
   - 再编辑这条新闻并删除，确认后它从列表中消失。
6. **经历**：
   - 在 Experiences 页点"添加工作经历"，分类已预选为"工作"，并且显示"描述"而不是 GPA。
   - 用"排序"把工作经历的顺序对调并保存，页面顺序随之改变。
7. **图片**：在一条经历的弹窗里，用脚本向文件输入框注入一张 2000×1000 的 PNG：

   ```js
   const canvas = Object.assign(document.createElement('canvas'), { width: 2000, height: 1000 });
   canvas.getContext('2d').fillRect(0, 0, 2000, 1000);
   const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
   const input = document.querySelector('input[type=file]');
   const dt = new DataTransfer();
   dt.items.add(new File([blob], 'Test Logo.png', { type: 'image/png' }));
   input.files = dt.files;
   input.dispatchEvent(new Event('change', { bubbles: true }));
   ```

   - 注入后弹窗里出现预览。
   - 保存后列表中的 logo 显示新图，来源是本地预览。
   - `[mock commit]` 日志里出现 `public/images/uploads/…-test-logo.png`。
8. **头像与联系方式**：
   - "更换照片"按钮在头像底部可见，点击后打开头像弹窗。
   - 联系方式弹窗可以新增一行、上移，也可以删除行。
   - 新增空行后直接保存，提示"请填写第 N 行的平台"。
9. **错误处理**：
   - 执行 `localStorage.setItem('mock-fail', 'conflict')` 后保存，弹窗顶部显示"内容已在别处修改…"，输入保留。
   - 改成 `'expired'` 后保存，显示"登录已过期…"。
   - 最后执行 `localStorage.removeItem('mock-fail')`。
10. **未保存提示**：改动字段后点取消，出现"放弃未保存的修改？"确认框。
11. **编辑模式开关**：关闭开关后所有编辑按钮消失，打开后恢复。
12. **退出**：点"退出"，管理栏消失，页脚重新出现锁形图标。
13. **手机尺寸**：`resize_window` 设为 mobile，打开一个弹窗，确认全屏显示、字段可以滚动，铅笔按钮不依赖悬停也能看到。最后恢复为 desktop。

- [ ] **Step 3：修复验证中发现的问题**

每个问题都要先补测试或明确复现步骤，修复后重新验证对应项目，并单独提交（`fix: …`）。

---

### Task 11：配置指南、README 与依赖安全更新

**Files:**
- Create: `docs/admin-setup.md`
- Modify: `README.md`
- Modify: `package.json`、`package-lock.json`（react-router-dom 升到 v6 内的修复版本）

- [ ] **Step 1：创建 `docs/admin-setup.md`**

````markdown file=docs/admin-setup.md
# 编辑模式：一次性配置与维护

网站的编辑模式由三部分组成：

| 部分 | 作用 | 位置 |
|---|---|---|
| GitHub App `zihanzhao-homepage-editor` | 提供"用 GitHub 登录"，并授予这个仓库的内容读写权限 | GitHub → Settings → Developer settings → GitHub Apps |
| Cloudflare Worker `homepage-auth` | 用 client secret 把登录授权码换成令牌，并且只放行 zihanzhao1022 | `auth-worker/`，部署在 Cloudflare |
| 网站里的编辑器 | 页脚锁形图标登录，编辑后提交到 `main` | `editor/`、`components/EditMode.tsx` |

## 一、GitHub App

1. 用预填好的链接创建：名称、回调地址（`https://zihanzhao1022.github.io/` 和 `http://localhost:3000/`）、权限（Contents 读写、Actions 只读）、关闭 webhook、仅限本账号。
2. 在 App 设置页记下 **Client ID**，点 **Generate a new client secret** 生成 secret。secret 只会显示一次，只用于下面第二步，不要提交到仓库。
3. 左侧 **Install App** → 选择本账号 → **Only select repositories** → 勾选 `zihanzhao1022.github.io`。

Client ID 已经填在 `editor/config.ts` 和 `auth-worker/wrangler.toml` 中。

## 二、Cloudflare Worker

在仓库的 `auth-worker` 目录下运行：

```bash
npx wrangler@4 login
npx wrangler@4 deploy
npx wrangler@4 secret put GITHUB_CLIENT_SECRET
```

`deploy` 输出的地址（`https://homepage-auth.<子域名>.workers.dev`）要填进 `editor/config.ts` 的 `workerUrl`，提交并推送后生效。

修改了 `auth-worker/` 中的代码或 `wrangler.toml` 之后，要重新运行 `npx wrangler@4 deploy`。

## 三、日常使用

- 点页脚版权文字后面的小锁图标登录。登录后页面顶部出现管理栏，各处出现编辑按钮。
- 每次保存都会立即提交到 `main`，GitHub Actions 自动部署，约 1 分钟后访客可以看到。管理栏会显示部署进度。
- 登录 8 小时后过期，再点一次登录即可，不需要重新授权。
- 本地调试界面用 `npm run dev:mock`：不需要登录，保存只写入内存。可以用 `localStorage.setItem('mock-fail', 'conflict' | 'network' | 'expired' | 'deploy')` 模拟各种失败。

## 四、出问题时

| 现象 | 原因与处理 |
|---|---|
| 看不到锁形图标 | `editor/config.ts` 中的 `clientId` 或 `workerUrl` 为空 |
| 登录后提示"该账号没有编辑权限" | 登录的不是 zihanzhao1022 |
| 登录后提示"登录失败" | 检查 Worker 的 secret 是否正确（重新运行 `secret put`），以及回调地址是否和 GitHub App 设置一致 |
| 保存时提示"没有写入权限" | GitHub App 没有安装到这个仓库，或缺少 Contents 写权限 |
| 管理栏显示"部署失败" | 点击查看 Actions 日志。线上会保持上一次成功的版本 |
| 怀疑令牌泄露 | 在 GitHub → Settings → Applications → Authorized GitHub Apps 中撤销授权，或在 App 设置页重新生成 client secret 后再运行一次 `secret put` |
````

- [ ] **Step 2：在 `README.md` 的"修改内容"一节末尾追加**

把

```markdown
改好后推送到 `main` 分支，也可以直接在 GitHub 网页上编辑这些文件。GitHub Actions 会自动测试、构建并发布，1–2 分钟后生效，进度可以在仓库的 Actions 页面查看。
```

替换为

```markdown
改好后推送到 `main` 分支，也可以直接在 GitHub 网页上编辑这些文件。GitHub Actions 会自动测试、构建并发布，1–2 分钟后生效，进度可以在仓库的 Actions 页面查看。

### 在网页上编辑

点页脚的小锁图标，用 GitHub 账号 zihanzhao1022 登录后进入编辑模式：每条内容旁有编辑按钮，各板块有"添加"按钮，保存后立即提交并自动部署。配置和维护方法见 [docs/admin-setup.md](docs/admin-setup.md)。本地调试编辑界面可以运行 `npm run dev:mock`，这时不需要登录，保存也不会写入 GitHub。
```

- [ ] **Step 3：升级 react-router-dom 到 v6 内已修复的版本**

```bash
npm audit fix --omit=dev
npm audit --omit=dev
node -p "require('./node_modules/react-router-dom/package.json').version"
```

Expected：生产依赖显示 `found 0 vulnerabilities`；react-router-dom 仍是 6.x。如果 `npm audit fix` 提示要升到 v7，不要升级，改为执行 `npm install react-router-dom@^6`，然后再次检查。

- [ ] **Step 4：运行全部测试和构建，然后提交**

Run: `npm test && npm run build`
Expected：全部通过。

```bash
git add docs/admin-setup.md README.md package.json package-lock.json
git commit -m "docs: add edit mode setup guide; update react-router-dom for security fixes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12：填入 Worker 地址、上线与端到端测试

**前置条件：** 所有者已经部署 Worker 并提供了地址。

- [ ] **Step 1：在 `editor/config.ts` 填入 `workerUrl`**

把

```ts
  workerUrl: '',
```

替换为（使用所有者提供的地址，不带末尾斜杠）

```ts
  workerUrl: 'https://homepage-auth.<子域名>.workers.dev',
```

- [ ] **Step 2：检查 Worker 的 CORS 配置**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS -H "Origin: https://zihanzhao1022.github.io" <workerUrl>/token
curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS -H "Origin: https://evil.example" <workerUrl>/token
```

Expected：第一条输出 `204`，第二条输出 `403`。

- [ ] **Step 3：测试、构建、提交**

```bash
npm test && npm run build
git add editor/config.ts
git commit -m "feat: point the edit mode at the deployed auth worker

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4：合并到 main 并部署（需要用户确认）**

```bash
git checkout main
git merge --ff-only feat/inline-edit-mode
git push origin main
```

然后用 `gh run list --workflow deploy.yml --limit 1 --json databaseId,headSha,status` 找到本次运行，执行 `gh run watch <id> --exit-status` 等待部署成功，最后执行 `git checkout feat/inline-edit-mode` 切回功能分支。

- [ ] **Step 5：和所有者一起做端到端测试**

1. 所有者打开 https://zihanzhao1022.github.io/ ，点页脚锁形图标，在 GitHub 授权页同意授权。
2. 回到网站后，确认管理栏出现，并且回到了点击登录前所在的页面。
3. 新增一条测试新闻并保存。确认：
   - 仓库出现 `content: add news item "…"` 提交；
   - Actions 部署成功；
   - 管理栏变为"已上线"；
   - 无痕窗口里能看到这条新闻。
4. 删除这条测试新闻，确认同样完成提交和部署。
5. 点"退出"。用 `gh api` 或重新登录确认旧令牌已失效。
````
