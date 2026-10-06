# 第一阶段：自动部署与内容迁移 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把内容从 `data.ts` 迁移到 `content/*.json`，页面改为通过 `useContent()` 读取；Tailwind 改为构建时编译；推送到 main 后由 GitHub Actions 自动部署。网站外观和文字保持不变。

**Architecture:**
- **内容加载：** 内容 JSON 在构建时由 `content/index.ts` 带类型导入，经 `ContentContext`（默认值为打包内容）提供给页面，第二阶段的编辑模式将通过同一个 context 注入最新内容。
- **测试：** 用"页面快照测试"保护重构：先用旧代码生成基线，迁移后快照必须保持一致；快照改用固定的测试数据，以后改内容不会让测试失败。
- **Tailwind 回归检查：** 迁移前后在浏览器里逐页比对所有元素的计算样式。

**Tech Stack:** Vite 5.4 · React 18.3 · TypeScript 5.9 · Tailwind CSS 3.4 · Vitest 3.2 · GitHub Actions（checkout v7、setup-node v7、upload-pages-artifact v5、deploy-pages v5）

**规格：** `docs/superpowers/specs/2026-10-06-inline-edit-mode-design.md`（本计划对应第 11 节第 1 项）

## Global Constraints

- 网站对访客的外观和文字必须与迁移前一致。唯一允许的 HTML 差异：简介中两个邮箱链接的属性引号从单引号变成双引号。
- Tailwind 保持 v3（`tailwindcss@^3.4.19`），不要升级到 v4。
- Vitest 使用 `^3.2.7`（兼容 vite 5），不要升级 vite。
- JSON 文件使用 2 空格缩进，末尾带换行。
- 页面不能再加载任何第三方脚本；Google Fonts 样式表保留。
- CI 使用 Node 24。
- 提交信息用英文，结尾带一行 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- 工作分支：`feat/inline-edit-mode`。只有 Task 7 才会合并到 main 并推送。

---

## 文件结构

| 路径 | 动作 | 职责 |
|---|---|---|
| `views/views.snapshot.test.tsx` | 新建 | 页面快照测试：渲染 7 个页面并与快照比对 |
| `views/__snapshots__/*.html` | 生成 | 7 个页面的快照 |
| `views/__fixtures__/content.json` | 生成 | 快照测试使用的固定内容 |
| `lib/markdown.ts` / `lib/markdown.test.ts` | 新建 | 轻量 Markdown 渲染及测试 |
| `content/*.json`（7 个） | 生成 | 网站内容 |
| `content/index.ts` | 新建 | 导入 JSON，导出 `bundledContent` |
| `content/content.test.ts` | 新建 | 内容校验：id 唯一、简介和新闻里不含 HTML |
| `components/ContentContext.tsx` | 新建 | `ContentContext` 与 `useContent()` |
| `types.ts` | 修改 | `NewsItem` 加 `id`；`Profile` 去掉 `news`；新增 `SiteContent` |
| `views/*.tsx`（7 个） | 修改 | 改用 `useContent()` |
| `data.ts` | 删除 | 被 `content/` 取代 |
| `tailwind.config.js` / `postcss.config.js` / `index.css` | 新建 | 构建时编译 Tailwind |
| `index.html` / `index.tsx` | 修改 | 去掉 CDN 脚本和 importmap，引入 `index.css` |
| `.github/workflows/deploy.yml` | 新建 | 自动测试、构建、部署 |
| `package.json` / `package-lock.json` | 修改 | 新增 vitest、tailwind 等依赖；删除 gh-pages 和 deploy 脚本 |
| `README.md` | 重写 | 内容位置、自动部署、本地开发说明 |

---

### Task 0：记录视觉基线（不提交）

在改动任何代码之前，记录当前网站（Tailwind CDN 版本）每个页面所有元素的计算样式，供 Task 5 比对。

**Files:**
- Create（不提交）：`.claude/launch.json`

**Interfaces:**
- Produces：浏览器 `localStorage` 中 `http://localhost:4173` 源下的 7 个键 `style-baseline:<hash>`，Task 5 用来比对。

- [ ] **Step 1：让 `.claude/` 不进入 Git**

```bash
echo ".claude/" >> .git/info/exclude
```

- [ ] **Step 2：创建 `.claude/launch.json`**

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "preview",
      "runtimeExecutable": "npx",
      "runtimeArgs": ["vite", "preview", "--port", "4173", "--strictPort"],
      "port": 4173
    },
    {
      "name": "dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 3000
    }
  ]
}
```

- [ ] **Step 3：构建当前代码并启动预览**

Run: `npm run build`
Expected: `✓ built`，输出 `dist/assets/index-Bs_LHtU1.js`。

然后用 `preview_start`（name: `preview`）打开 `http://localhost:4173/`，再用 `resize_window` 把视口设为 1280×900。

- [ ] **Step 4：逐页记录样式**

依次 `navigate` 到以下 7 个地址，每到一个页面就用 `javascript_tool` 执行下面的脚本（`MODE` 为 `'record'`）：

`http://localhost:4173/#/`、`#/experiences`、`#/publications`、`#/projects`、`#/talks`、`#/awards`、`#/cv`

```js
await (async (MODE) => {
  await document.fonts.ready;
  await Promise.all([...document.images].map((img) => img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; })));
  await new Promise((r) => setTimeout(r, 300));
  const props = ['display','position','top','left','right','bottom','margin-top','margin-right','margin-bottom','margin-left','padding-top','padding-right','padding-bottom','padding-left','width','height','color','background-color','font-size','font-weight','font-family','font-style','line-height','letter-spacing','text-align','text-transform','text-decoration-line','border-top-width','border-right-width','border-bottom-width','border-left-width','border-top-color','border-left-color','border-top-left-radius','box-shadow','gap','flex-direction','flex-wrap','align-items','justify-content','opacity','transform','cursor','z-index','overflow-x','overflow-y','object-fit','white-space','visibility'];
  const rows = [...document.querySelectorAll('body *')].map((el) => {
    const cs = getComputedStyle(el);
    return [el.tagName, el.getAttribute('class') || '', ...props.map((p) => cs.getPropertyValue(p))].join('|');
  });
  const key = 'style-baseline:' + location.hash;
  if (MODE === 'record') {
    localStorage.setItem(key, JSON.stringify(rows));
    return { route: location.hash, recorded: rows.length };
  }
  const base = JSON.parse(localStorage.getItem(key) || '[]');
  const diffs = [];
  for (let i = 0; i < Math.max(base.length, rows.length); i++) {
    if (base[i] !== rows[i]) diffs.push({ i, before: base[i], after: rows[i] });
  }
  return { route: location.hash, before: base.length, after: rows.length, diffCount: diffs.length, firstDiffs: diffs.slice(0, 5) };
})('record')
```

Expected：每个页面返回 `{ route, recorded: <数字> }`，且数字大于 0。顺便给每个页面截一张图留档。

---

### Task 1：测试基础设施与页面快照基线

**Files:**
- Modify: `package.json`（新增 `vitest` 依赖和 `test` 脚本）
- Create: `views/views.snapshot.test.tsx`
- Create（自动生成）：`views/__snapshots__/{About,Awards,CV,Experiences,Projects,Publications,Talks}.html`

**Interfaces:**
- Produces：`npm test` 命令；快照文件 `views/__snapshots__/<View>.html`。后续任务改动页面后必须保持这些快照不变（Task 4 中有一处预期内的差异）。

- [ ] **Step 1：安装 Vitest**

```bash
npm install -D vitest@^3.2.7
```

- [ ] **Step 2：在 `package.json` 的 `scripts` 中加入 `test`**

```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "predeploy": "npm run build",
  "deploy": "gh-pages -d dist"
},
```

- [ ] **Step 3：编写快照测试 `views/views.snapshot.test.tsx`**

```tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import About from './About';
import Awards from './Awards';
import CV from './CV';
import Experiences from './Experiences';
import Projects from './Projects';
import Publications from './Publications';
import Talks from './Talks';

const VIEWS: Record<string, React.ComponentType> = {
  About,
  Awards,
  CV,
  Experiences,
  Projects,
  Publications,
  Talks,
};

// One tag per line keeps snapshot diffs readable.
const render = (View: React.ComponentType): string =>
  renderToStaticMarkup(<View />).replace(/></g, '>\n<') + '\n';

describe('views render unchanged markup', () => {
  for (const [name, View] of Object.entries(VIEWS)) {
    it(name, async () => {
      await expect(render(View)).toMatchFileSnapshot(`./__snapshots__/${name}.html`);
    });
  }
});
```

- [ ] **Step 4：生成基线快照**

Run: `npm test`
Expected: `7 passed`，并提示写入了 7 个快照文件。`views/__snapshots__/` 下出现 7 个 `.html` 文件。

- [ ] **Step 5：再跑一次，确认快照稳定**

Run: `npm test`
Expected: `7 passed`，没有写入新快照。

- [ ] **Step 6：类型检查**

Run: `npx tsc`
Expected: 没有输出（通过）。

- [ ] **Step 7：提交**

```bash
git add package.json package-lock.json views/views.snapshot.test.tsx views/__snapshots__
git commit -m "test: add vitest and baseline snapshots for all views

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2：轻量 Markdown 渲染

**Files:**
- Create: `lib/markdown.ts`
- Test: `lib/markdown.test.ts`

**Interfaces:**
- Produces：`renderInlineMarkdown(source: string): string`，返回可直接放进 `dangerouslySetInnerHTML` 的安全 HTML。只支持 `[文字](链接)` 和 `**加粗**`。

- [ ] **Step 1：编写失败的测试 `lib/markdown.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { renderInlineMarkdown } from './markdown';

const LINK_ATTRS = 'target="_blank" rel="noreferrer" class="text-purple-600 hover:underline font-medium"';

describe('renderInlineMarkdown', () => {
  it('returns plain text unchanged', () => {
    expect(renderInlineMarkdown("My homepage was deployed! 🚀 It's live.")).toBe(
      "My homepage was deployed! 🚀 It's live.",
    );
  });

  it('escapes HTML', () => {
    expect(renderInlineMarkdown('<img src=x onerror="alert(1)"> & more')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; more',
    );
  });

  it('renders links', () => {
    expect(renderInlineMarkdown('Mail [me](mailto:a@b.org) or see [site](https://x.org/a?b=1&c=2).')).toBe(
      `Mail <a href="mailto:a@b.org" ${LINK_ATTRS}>me</a> or see <a href="https://x.org/a?b=1&amp;c=2" ${LINK_ATTRS}>site</a>.`,
    );
  });

  it('allows site-relative links', () => {
    expect(renderInlineMarkdown('[cv](/files/cv.pdf) [top](#/about) [doc](./a.pdf)')).toBe(
      `<a href="/files/cv.pdf" ${LINK_ATTRS}>cv</a> <a href="#/about" ${LINK_ATTRS}>top</a> <a href="./a.pdf" ${LINK_ATTRS}>doc</a>`,
    );
  });

  it('renders unsafe links as plain text', () => {
    expect(
      renderInlineMarkdown('[a](javascript:alert) [b](JavaScript:alert) [c](data:text/html,hi) [d](//evil.example)'),
    ).toBe('a b c d');
  });

  it('renders bold, including inside link text', () => {
    expect(renderInlineMarkdown('**Zihan** and [**paper**](https://x.org)')).toBe(
      `<strong>Zihan</strong> and <a href="https://x.org" ${LINK_ATTRS}><strong>paper</strong></a>`,
    );
  });

  it('leaves unmatched markers alone', () => {
    expect(renderInlineMarkdown('2 * 3 = 6, [not a link] (x), **open')).toBe('2 * 3 = 6, [not a link] (x), **open');
  });
});
```

- [ ] **Step 2：运行测试，确认失败**

Run: `npx vitest run lib/markdown.test.ts`
Expected: FAIL，提示找不到 `./markdown` 模块。

- [ ] **Step 3：实现 `lib/markdown.ts`**

```ts
const LINK_CLASS = 'text-purple-600 hover:underline font-medium';

// http(s), mailto, and site paths ("/x" but not "//host", "#/x", "./x").
const SAFE_URL = /^(https?:|mailto:|\/(?!\/)|#|\.\/)/i;

// Text only ever lands in element content or double-quoted attributes, so these four are enough.
const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Renders the Markdown subset used in bio and news: [text](url) and **bold**.
 * Everything else is HTML-escaped, so the result is safe for dangerouslySetInnerHTML.
 */
export function renderInlineMarkdown(source: string): string {
  return escapeHtml(source)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, text: string, url: string) =>
      SAFE_URL.test(url)
        ? `<a href="${url}" target="_blank" rel="noreferrer" class="${LINK_CLASS}">${text}</a>`
        : text,
    )
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}
```

- [ ] **Step 4：运行测试，确认通过**

Run: `npx vitest run lib/markdown.test.ts`
Expected: `7 passed`。

- [ ] **Step 5：提交**

```bash
git add lib/markdown.ts lib/markdown.test.ts
git commit -m "feat: add safe inline markdown renderer for bio and news

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3：内容迁移到 JSON（纯重构，页面输出零差异）

**Files:**
- Create（脚本生成）：`content/profile.json`、`content/news.json`、`content/experiences.json`、`content/publications.json`、`content/projects.json`、`content/talks.json`、`content/awards.json`
- Create: `content/index.ts`
- Create: `content/content.test.ts`
- Create: `components/ContentContext.tsx`
- Create（脚本生成）：`views/__fixtures__/content.json`
- Modify: `types.ts`
- Modify: `views/About.tsx`、`views/Awards.tsx`、`views/CV.tsx`、`views/Experiences.tsx`、`views/Projects.tsx`、`views/Publications.tsx`、`views/Talks.tsx`
- Modify: `views/views.snapshot.test.tsx`
- Delete: `data.ts`

**Interfaces:**
- Consumes：Task 1 的快照文件（必须保持不变）。
- Produces：
  - `types.ts`：`NewsItem { id: string; date: string; content: string }`；`Profile` 不再有 `news`；`SiteContent { profile: Profile; news: NewsItem[]; experiences: Experience[]; publications: Publication[]; projects: Project[]; talks: Talk[]; awards: Award[] }`
  - `content/index.ts`：`export const bundledContent: SiteContent`
  - `components/ContentContext.tsx`：`export const ContentContext: React.Context<SiteContent>`（默认值为 `bundledContent`）；`export const useContent: () => SiteContent`

- [ ] **Step 1：编写失败的内容测试 `content/content.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { bundledContent } from './index';

describe('bundled content', () => {
  it('gives every list item a unique id', () => {
    const { news, experiences, publications, projects, talks, awards } = bundledContent;
    const lists: { id: string }[][] = [news, experiences, publications, projects, talks, awards];
    for (const list of lists) {
      const ids = list.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
```

Run: `npx vitest run content/content.test.ts`
Expected: FAIL，提示找不到 `./index` 模块。

- [ ] **Step 2：用一次性脚本从 `data.ts` 生成 JSON**

脚本放在 scratchpad 目录，不进入仓库。把下面的 `<SCRATCH>` 替换为会话的 scratchpad 路径：

```ts
// <SCRATCH>/migrate-content.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { awardsList, experiences, profile, projects, publications, talks } from '/Users/zhaozihan/Projects/zihanzhao1022.github.io/data';

const dir = '/Users/zhaozihan/Projects/zihanzhao1022.github.io/content';
const write = (name: string, value: unknown) =>
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(value, null, 2) + '\n');

const { news, ...profileWithoutNews } = profile;
mkdirSync(dir, { recursive: true });
write('profile', profileWithoutNews);
write('news', news.map((item, i) => ({ id: `n${i + 1}`, ...item })));
write('experiences', experiences);
write('publications', publications);
write('projects', projects);
write('talks', talks);
write('awards', awardsList);
```

Run: `npx --yes tsx <SCRATCH>/migrate-content.ts && ls content`
Expected: 列出 7 个 `.json` 文件。`content/news.json` 只有一条：`{ "id": "n1", "date": "Jan 20, 2025", "content": "My academic homepage was successfully deployed! 🚀" }`。

注意：`data.ts` 中被注释掉的两条新闻草稿不会迁移（它们本来就不显示，仍然保留在 Git 历史里），完成后要在汇报中告知用户。

- [ ] **Step 3：修改 `types.ts`**

把 `NewsItem` 改为：

```ts
export interface NewsItem {
  id: string;
  date: string;
  content: string;
}
```

删除 `Profile` 中的这一行：

```ts
  news: NewsItem[];
```

在文件末尾追加：

```ts
export interface SiteContent {
  profile: Profile;
  news: NewsItem[];
  experiences: Experience[];
  publications: Publication[];
  projects: Project[];
  talks: Talk[];
  awards: Award[];
}
```

- [ ] **Step 4：创建 `content/index.ts`**

```ts
import { Award, Experience, NewsItem, Profile, Project, Publication, SiteContent, Talk } from '../types';
import awards from './awards.json';
import experiences from './experiences.json';
import news from './news.json';
import profile from './profile.json';
import projects from './projects.json';
import publications from './publications.json';
import talks from './talks.json';

// Content bundled at build time. The edit mode replaces it with the latest version from GitHub.
export const bundledContent: SiteContent = {
  profile: profile as Profile,
  news: news as NewsItem[],
  experiences: experiences as Experience[],
  publications: publications as Publication[],
  projects: projects as Project[],
  talks: talks as Talk[],
  awards: awards as Award[],
};
```

Run: `npx vitest run content/content.test.ts`
Expected: `1 passed`。

- [ ] **Step 5：创建 `components/ContentContext.tsx`**

```tsx
import { createContext, useContext } from 'react';
import { bundledContent } from '../content';
import { SiteContent } from '../types';

// Visitors see the bundled content. The edit mode provides fresher content through this context.
export const ContentContext = createContext<SiteContent>(bundledContent);

export const useContent = (): SiteContent => useContext(ContentContext);
```

- [ ] **Step 6：`views/About.tsx` 改用 `useContent()`**

把

```tsx
import { profile } from '../data';
```

替换为

```tsx
import { useContent } from '../components/ContentContext';
```

把

```tsx
const About: React.FC = () => {
  const [activeQr, setActiveQr] = useState<string | null>(null);
```

替换为

```tsx
const About: React.FC = () => {
  const { profile, news } = useContent();
  const [activeQr, setActiveQr] = useState<string | null>(null);
```

把

```tsx
          {profile.news.map((item, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row gap-2 sm:gap-8 text-sm">
```

替换为

```tsx
          {news.map((item) => (
            <div key={item.id} className="flex flex-col sm:flex-row gap-2 sm:gap-8 text-sm">
```

- [ ] **Step 7：`views/Awards.tsx` 改用 `useContent()`**

把

```tsx
import { awardsList } from '../data';
```

替换为

```tsx
import { useContent } from '../components/ContentContext';
```

把

```tsx
const Awards: React.FC = () => {
  const [filter, setFilter] = useState('');
```

替换为

```tsx
const Awards: React.FC = () => {
  const { awards } = useContent();
  const [filter, setFilter] = useState('');
```

把

```tsx
    const filtered = awardsList.filter(item => {
```

替换为

```tsx
    const filtered = awards.filter(item => {
```

把（第一个 `useMemo` 的依赖）

```tsx
    return filtered.sort((a, b) => b.year - a.year);
  }, [filter, selectedType]);
```

替换为

```tsx
    return filtered.sort((a, b) => b.year - a.year);
  }, [awards, filter, selectedType]);
```

- [ ] **Step 8：`views/CV.tsx` 改用 `useContent()`**

把

```tsx
import { profile, publications, projects, talks } from '../data';
```

替换为

```tsx
import { useContent } from '../components/ContentContext';
```

把

```tsx
const CV: React.FC = () => {
  // Sort publications by year desc for the CV
```

替换为

```tsx
const CV: React.FC = () => {
  const { profile, publications, projects, talks } = useContent();
  // Sort publications by year desc for the CV
```

- [ ] **Step 9：`views/Experiences.tsx` 改用 `useContent()`**

把

```tsx
import { experiences } from '../data';
```

替换为

```tsx
import { useContent } from '../components/ContentContext';
```

把

```tsx
const Experiences: React.FC = () => {
  return (
```

替换为

```tsx
const Experiences: React.FC = () => {
  const { experiences } = useContent();
  return (
```

- [ ] **Step 10：`views/Projects.tsx` 改用 `useContent()`**

把

```tsx
import { projects } from '../data';
```

替换为

```tsx
import { useContent } from '../components/ContentContext';
```

把

```tsx
const Projects: React.FC = () => {
  // Helper to extract the start year from a string like "2023 - Present"
```

替换为

```tsx
const Projects: React.FC = () => {
  const { projects } = useContent();
  // Helper to extract the start year from a string like "2023 - Present"
```

把

```tsx
    return [...projects].sort((a, b) => getStartYear(b.year) - getStartYear(a.year));
  }, []);
```

替换为

```tsx
    return [...projects].sort((a, b) => getStartYear(b.year) - getStartYear(a.year));
  }, [projects]);
```

- [ ] **Step 11：`views/Publications.tsx` 改用 `useContent()`**

把

```tsx
import { publications } from '../data';
```

替换为

```tsx
import { useContent } from '../components/ContentContext';
```

把

```tsx
const Publications: React.FC = () => {
  const [filter, setFilter] = useState('');
```

替换为

```tsx
const Publications: React.FC = () => {
  const { publications } = useContent();
  const [filter, setFilter] = useState('');
```

把

```tsx
  }, [filter, selectedType, selectedRanks]);
```

替换为

```tsx
  }, [publications, filter, selectedType, selectedRanks]);
```

- [ ] **Step 12：`views/Talks.tsx` 改用 `useContent()`**

把

```tsx
import { talks } from '../data';
```

替换为

```tsx
import { useContent } from '../components/ContentContext';
```

把

```tsx
const Talks: React.FC = () => {
  return (
```

替换为

```tsx
const Talks: React.FC = () => {
  const { talks } = useContent();
  return (
```

- [ ] **Step 13：删除 `data.ts`，确认没有残留引用**

```bash
git rm data.ts
grep -rn "from '\.\./data'\|from './data'" --include=*.ts --include=*.tsx . --exclude-dir=node_modules
```

Expected: `grep` 没有输出。

- [ ] **Step 14：生成快照测试用的固定内容**

```bash
node -e "const fs=require('fs');const c={};for(const n of ['profile','news','experiences','publications','projects','talks','awards'])c[n]=JSON.parse(fs.readFileSync('content/'+n+'.json','utf8'));fs.mkdirSync('views/__fixtures__',{recursive:true});fs.writeFileSync('views/__fixtures__/content.json',JSON.stringify(c,null,2)+'\n')"
```

- [ ] **Step 15：快照测试改为用固定内容渲染**

在 `views/views.snapshot.test.tsx` 中，把

```tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
```

替换为

```tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ContentContext } from '../components/ContentContext';
import { SiteContent } from '../types';
import fixture from './__fixtures__/content.json';
```

把

```tsx
// One tag per line keeps snapshot diffs readable.
const render = (View: React.ComponentType): string =>
  renderToStaticMarkup(<View />).replace(/></g, '>\n<') + '\n';
```

替换为

```tsx
// A frozen copy of the content, so editing the real content never breaks these snapshots.
const content = fixture as SiteContent;

// One tag per line keeps snapshot diffs readable.
const render = (View: React.ComponentType): string =>
  renderToStaticMarkup(
    <ContentContext.Provider value={content}>
      <View />
    </ContentContext.Provider>,
  ).replace(/></g, '>\n<') + '\n';
```

- [ ] **Step 16：运行全部测试和构建**

Run: `npm test`
Expected: 全部通过（7 个快照 + 1 个内容测试 + 7 个 Markdown 测试 = 15 passed），并且 `git status views/__snapshots__` 没有任何改动。

Run: `npm run build`
Expected: `tsc` 通过，`✓ built`。

- [ ] **Step 17：提交**

```bash
git add types.ts content components/ContentContext.tsx views
git commit -m "refactor: move site content from data.ts to typed JSON files

Pages now read content through useContent(), so the upcoming edit mode
can swap in fresher content. News moves out of profile into its own
file and every news item gets an id.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4：简介与新闻改用轻量 Markdown

**Files:**
- Modify: `content/content.test.ts`
- Modify: `content/profile.json`（简介第一段）
- Modify: `views/__fixtures__/content.json`（简介第一段，与上面相同）
- Modify: `views/About.tsx`
- Modify: `views/__snapshots__/About.html`（审查后更新）

**Interfaces:**
- Consumes：Task 2 的 `renderInlineMarkdown`；Task 3 的 `bundledContent`。

- [ ] **Step 1：在 `content/content.test.ts` 中加一条失败的测试**

在 `describe('bundled content', () => {` 内追加：

```ts
  it('uses Markdown instead of raw HTML in bio and news', () => {
    const texts = [...bundledContent.profile.bio, ...bundledContent.news.map((item) => item.content)];
    for (const text of texts) {
      expect(text).not.toMatch(/<[a-z/]/i);
    }
  });
```

Run: `npx vitest run content/content.test.ts`
Expected: FAIL，简介第一段里匹配到了 `<a`。

- [ ] **Step 2：把简介第一段的 HTML 链接改成 Markdown**

在 `content/profile.json` 和 `views/__fixtures__/content.json` 中，把 `bio` 的第一段整体替换为：

```json
"I am Zihan Zhao (子涵 赵 in Chinese), currently a Ph.D. candidate under the supervision of Professor Makoto Onizuka at the University of Osaka. My research interests focus on Self-Evolving AI Agents. Researchers and collaborators interested in Self-Evolving AI Agents are welcome to contact me via email: [zihan.zhao@ieee.org](mailto:zihan.zhao@ieee.org) or [zihanzhao1022@gmail.com](mailto:zihanzhao1022@gmail.com)."
```

Run: `npx vitest run content/content.test.ts`
Expected: `2 passed`。

- [ ] **Step 3：`views/About.tsx` 用 Markdown 渲染简介和新闻**

在 import 区加入：

```tsx
import { renderInlineMarkdown } from '../lib/markdown';
```

把

```tsx
              <p key={idx} dangerouslySetInnerHTML={{ __html: paragraph }} />
```

替换为

```tsx
              <p key={idx} dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(paragraph) }} />
```

把

```tsx
              <div className="text-gray-600">{item.content}</div>
```

替换为

```tsx
              <div className="text-gray-600" dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(item.content) }} />
```

- [ ] **Step 4：运行快照测试，审查差异**

Run: `npx vitest run views/views.snapshot.test.tsx`
Expected: 只有 `About` 失败。差异只有简介第一段那一行：两个 `<a>` 标签的属性从单引号变成双引号（`href='mailto:…' target='_blank' rel='noreferrer' class='…'` → `href="mailto:…" target="_blank" rel="noreferrer" class="…"`），链接地址、文字和 class 都不变。其他页面和其他行没有任何差异。如果出现其他差异，停下来排查。

- [ ] **Step 5：确认差异后更新快照**

Run: `npx vitest run -u views/views.snapshot.test.tsx && npm test`
Expected: 全部通过（16 passed）。

- [ ] **Step 6：提交**

```bash
git add content views lib
git commit -m "feat: render bio and news with inline markdown instead of raw HTML

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5：Tailwind 改为构建时编译

**Files:**
- Modify: `package.json`、`package-lock.json`
- Create: `tailwind.config.js`、`postcss.config.js`、`index.css`
- Modify: `index.html`、`index.tsx`

**Interfaces:**
- Consumes：Task 0 记录在浏览器里的样式基线。

- [ ] **Step 1：安装依赖**

```bash
npm install -D tailwindcss@^3.4.19 postcss@^8.5.29 autoprefixer@^10.6.1
```

- [ ] **Step 2：创建 `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './App.tsx',
    './index.tsx',
    './components/**/*.{ts,tsx}',
    './views/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './editor/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

- [ ] **Step 3：创建 `postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 4：创建 `index.css`（把 `index.html` 里的自定义样式搬过来）**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body { font-family: 'Inter', sans-serif; }

/* Custom scrollbar for webkit */
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: #f1f1f1; }
::-webkit-scrollbar-thumb { background: #888; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #555; }
```

- [ ] **Step 5：在 `index.tsx` 中引入样式**

把

```tsx
import App from './App';
```

替换为

```tsx
import App from './App';
import './index.css';
```

- [ ] **Step 6：用下面的内容替换整个 `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Zihan ZHAO - Academic Homepage</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  </head>
  <body class="bg-white text-gray-900 antialiased">
    <div id="root"></div>
    <script type="module" src="/index.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7：构建并检查产物**

```bash
npm run build
grep -c "cdn.tailwindcss.com\|importmap\|esm.sh" dist/index.html
grep -o "assets/[^\"]*\.css" dist/index.html
grep -c "text-purple-600" dist/assets/*.css
```

Expected：构建通过；第一个 `grep` 输出 `0`；第二个输出一个 css 文件名；第三个大于 `0`。

- [ ] **Step 8：与视觉基线逐页比对**

预览服务仍在 4173 端口运行，会直接提供新的 `dist`。先在页面里执行 `location.reload()`，保持 1280×900 视口，然后依次 `navigate` 到 Task 0 的 7 个地址，每页执行 Task 0 的脚本，只是把最后一行的 `('record')` 改成 `('compare')`。

Expected：每个页面都返回 `diffCount: 0`。如果有差异，根据 `firstDiffs` 中的 `before`/`after` 找出属性和元素，修正后重新比对。如果浏览器里的基线丢失（`before: 0`），就用 `git worktree add <SCRATCH>/baseline main` 构建旧版本，在 4173 端口重新执行 Task 0 的记录步骤。

- [ ] **Step 9：运行测试并提交**

Run: `npm test`
Expected: 全部通过。

```bash
git add package.json package-lock.json tailwind.config.js postcss.config.js index.css index.html index.tsx
git commit -m "build: compile Tailwind at build time and drop the CDN script

The page no longer runs third-party scripts, which matters once an
access token lives in the browser. Also removes the unused AI Studio
importmap. Computed styles are identical on every page.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6：自动部署工作流、清理与 README

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `package.json`、`package-lock.json`（删除 gh-pages 及 deploy 脚本）
- Modify: `README.md`（重写）

- [ ] **Step 1：删除 gh-pages 和本地部署脚本**

```bash
npm uninstall gh-pages
```

然后把 `package.json` 的 `scripts` 改成：

```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "test": "vitest run"
},
```

- [ ] **Step 2：创建 `.github/workflows/deploy.yml`**

```yaml
name: Deploy site

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

# Let a running deployment finish; a newer push replaces any queued one.
concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

- [ ] **Step 3：检查 YAML 语法**

Run: `npx --yes js-yaml@4 .github/workflows/deploy.yml > /dev/null && echo YAML OK`
Expected: `YAML OK`。

- [ ] **Step 4：重写 `README.md`**

````markdown
# Zihan ZHAO 的学术主页

线上地址：https://zihanzhao1022.github.io/

使用 Vite + React + TypeScript + Tailwind CSS 构建，部署在 GitHub Pages 上。

## 修改内容

网站内容都在 `content/` 目录下的 JSON 文件里：

| 文件 | 内容 |
|---|---|
| `content/profile.json` | 姓名、职位、简介、头像、联系方式、语言等 |
| `content/news.json` | 新闻 |
| `content/experiences.json` | 教育、工作、志愿经历 |
| `content/publications.json` | 论文 |
| `content/projects.json` | 项目 |
| `content/talks.json` | 报告 |
| `content/awards.json` | 奖项 |

- 简介和新闻支持 `[文字](链接)` 和 `**加粗**`，不支持其他 HTML。
- 论文作者用 `**名字**` 表示加粗高亮。
- 图片放在 `public/images/` 下，在 JSON 里用 `/images/...` 引用。
- 列表里的每一条都需要一个不重复的 `id`。

改好后推送到 `main` 分支，也可以直接在 GitHub 网页上编辑这些文件。GitHub Actions 会自动测试、构建并发布，1–2 分钟后生效，进度可以在仓库的 Actions 页面查看。

## 本地开发

```bash
npm install
npm run dev      # 本地预览：http://localhost:3000
npm test         # 运行测试
npm run build    # 生产构建，输出到 dist/
```

`views/__snapshots__/` 里是页面快照测试，用的是 `views/__fixtures__/content.json` 中的固定内容，所以修改网站内容不会让它失败。修改页面结构后，如果快照测试失败，确认差异符合预期，再运行 `npx vitest run -u` 更新快照。
````

- [ ] **Step 5：模拟一次 CI**

```bash
rm -rf node_modules dist && npm ci && npm test && npm run build
```

Expected：`npm ci` 成功；测试全部通过；构建通过。

- [ ] **Step 6：提交**

```bash
git add .github/workflows/deploy.yml package.json package-lock.json README.md
git commit -m "ci: deploy to GitHub Pages with Actions on every push to main

Replaces the local gh-pages deploy script.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7：上线

用户已在对话中确认"可以先部署页面"。下面几步会改变线上网站和仓库设置，按顺序执行，每一步都核对结果。

- [ ] **Step 1：最终检查**

```bash
git status --short
npm test && npm run build
```

Expected：工作区干净（`.claude/` 已被排除）；测试和构建通过。

- [ ] **Step 2：快进合并到 main**

```bash
git checkout main
git merge --ff-only feat/inline-edit-mode
```

Expected：`Fast-forward`。

- [ ] **Step 3：把 Pages 来源切换为 GitHub Actions**

```bash
gh api -X PUT repos/zihanzhao1022/zihanzhao1022.github.io/pages -f build_type=workflow
gh api repos/zihanzhao1022/zihanzhao1022.github.io/pages --jq .build_type
```

Expected：输出 `workflow`。

- [ ] **Step 4：推送 main，等待部署完成**

```bash
git push origin main
gh run list --workflow deploy.yml --limit 1 --json databaseId,headSha,status
```

确认列出的运行的 `headSha` 等于刚推送的提交（`git rev-parse main`）。刚推送时运行可能还没登记，过几秒再查一次即可（不要用前台 `sleep`）。拿到 `databaseId` 后：

```bash
gh run watch <databaseId> --exit-status
```

Expected：`build` 和 `deploy` 两个 job 都成功。

- [ ] **Step 5：验证线上网站**

```bash
curl -sS https://zihanzhao1022.github.io/ | grep -o 'assets/[^"]*'
curl -sS https://zihanzhao1022.github.io/ | grep -c "cdn.tailwindcss.com"
```

Expected：资源文件名与本地 `dist/index.html` 一致（包含一个 `.css` 文件）；第二条输出 `0`。（Pages 可能缓存旧页面最多约 10 分钟；如果还是旧文件名，等几分钟再试。）

然后在浏览器里打开 `https://zihanzhao1022.github.io/`，逐个访问 7 个页面，确认内容和样式正常、简介里的两个邮箱链接可以点击、控制台没有报错。

- [ ] **Step 6：切回功能分支，准备第二阶段**

```bash
git checkout feat/inline-edit-mode
```
