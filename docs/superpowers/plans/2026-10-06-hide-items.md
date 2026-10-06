# 隐藏条目 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在编辑弹窗的"删除"旁边增加"隐藏 / 取消隐藏"。隐藏的条目保留在数据里，但不对访客展示。

**Architecture:**
- **数据**：列表条目增加可选的 `hidden` 标记，由新的内容操作 `setHidden` 写入。
- **访客**：构建时由 Vite 插件把隐藏条目从打包内容里剔除；渲染时由 `useVisibleItems` 在非编辑状态下过滤。
- **编辑模式**：内容从 GitHub 读取，因此包含隐藏条目，这些条目显示为半透明并带"已隐藏"标签。

**Tech Stack:** React 18 · TypeScript 5.9 · Vite 5 插件 API · Vitest 3.2

**规格：** `docs/superpowers/specs/2026-10-06-hide-items-design.md`

## Global Constraints

- 已有页面快照（`views/__snapshots__/`）必须保持不变：没有隐藏条目时，访客看到的 HTML 一字不差。
- 隐藏时写入 `"hidden": true`；取消隐藏时删除 `hidden` 键，不写 `false`。
- 提交信息格式为 `content: hide <对象> "<标题>"` 和 `content: unhide <对象> "<标题>"`。
- 编辑界面用中文：按钮"隐藏"/"取消隐藏"，标签"已隐藏"，提示"这一条目前对访客隐藏。"
- 代码提交信息用英文，结尾带 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- 带 `file=路径` 的代码块是新文件的完整内容，可以用 scratchpad 里的 `extract-plan.mjs` 写出。

---

### Task 1：`hidden` 字段与 `setHidden` 操作

**Files:**
- Modify: `types.ts`、`editor/ops.ts`
- Test: `editor/ops.test.ts`

**Interfaces:**
- Produces：
  - 6 种列表条目类型（`NewsItem`、`Publication`、`Project`、`Talk`、`Award`、`Experience`）都带可选的 `hidden?: boolean`。
  - `ContentOp` 新增 `{ kind: 'setHidden'; collection: ListCollection; id: string; hidden: boolean }`。
  - `commitMessage` 的 `action` 新增 `'hide' | 'unhide'`。

- [ ] **Step 1：在 `editor/ops.test.ts` 中加入失败的测试**

在 `describe('applyListOp', () => {` 内，`it('does not change the input list', …)` 之前加入：

```ts
  it('hides and unhides an item without touching anything else', () => {
    const hidden = applyListOp(list, { kind: 'setHidden', collection: 'experiences', id: 'b', hidden: true });
    expect(hidden).toEqual([list[0], { id: 'b', category: 'education', hidden: true }, list[2], list[3]]);
    const shown = applyListOp(hidden, { kind: 'setHidden', collection: 'experiences', id: 'b', hidden: false });
    expect(shown[1]).toEqual({ id: 'b', category: 'education' });
    expect('hidden' in shown[1]).toBe(false);
  });
```

在 `describe('commitMessage', () => {` 的第一个 `it` 末尾（`expect(commitMessage('update', 'profile bio'))…` 之后）加入：

```ts
    expect(commitMessage('hide', 'publication', 'Old paper')).toBe('content: hide publication "Old paper"');
    expect(commitMessage('unhide', 'talk', 'A talk')).toBe('content: unhide talk "A talk"');
```

Run: `npx vitest run editor/ops.test.ts`
Expected: FAIL（`setHidden` 未处理，`commitMessage` 不接受 `'hide'`，tsc 也会报错）。

- [ ] **Step 2：`types.ts` 增加 `Hideable`**

在 `export interface NewsItem {` 之前插入：

```ts
/** List items can be hidden: kept in the data, left out for visitors. */
interface Hideable {
  hidden?: boolean;
}

```

然后把以下 6 处声明分别改为继承 `Hideable`：

- `export interface NewsItem {` → `export interface NewsItem extends Hideable {`
- `export interface Publication {` → `export interface Publication extends Hideable {`
- `export interface Project {` → `export interface Project extends Hideable {`
- `export interface Talk {` → `export interface Talk extends Hideable {`
- `export interface Award {` → `export interface Award extends Hideable {`
- `export interface Experience {` → `export interface Experience extends Hideable {`

- [ ] **Step 3：`editor/ops.ts` 支持 `setHidden`**

把

```ts
  | { kind: 'reorder'; collection: ListCollection; ids: string[] }
```

替换为

```ts
  | { kind: 'reorder'; collection: ListCollection; ids: string[] }
  | { kind: 'setHidden'; collection: ListCollection; id: string; hidden: boolean }
```

把

```ts
    case 'delete':
      return list.filter((entry) => entry.id !== op.id);
```

替换为

```ts
    case 'delete':
      return list.filter((entry) => entry.id !== op.id);
    case 'setHidden':
      return list.map((entry) => {
        if (entry.id !== op.id) return entry;
        const next: Record<string, unknown> = { ...entry };
        if (op.hidden) next.hidden = true;
        else delete next.hidden;
        return next as unknown as T;
      });
```

把

```ts
export function commitMessage(action: 'add' | 'update' | 'delete' | 'reorder', target: string, label?: string): string {
```

替换为

```ts
export function commitMessage(
  action: 'add' | 'update' | 'delete' | 'reorder' | 'hide' | 'unhide',
  target: string,
  label?: string,
): string {
```

- [ ] **Step 4：运行测试与类型检查**

Run: `npx vitest run editor/ops.test.ts && npx tsc`
Expected：`11 passed`；`tsc` 无输出。

- [ ] **Step 5：提交**

```bash
git add types.ts editor/ops.ts editor/ops.test.ts
git commit -m "feat: add a hidden flag and setHidden content operation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2：构建时剔除隐藏条目

**Files:**
- Create: `lib/hiddenContent.ts`
- Test: `lib/hiddenContent.test.ts`
- Modify: `vite.config.ts`

**Interfaces:**
- Produces：`stripHiddenItems(json: string): string`、`isContentListFile(id: string): boolean`；Vite 插件 `strip-hidden-content`。

- [ ] **Step 1：编写失败的测试**

```ts file=lib/hiddenContent.test.ts
import { describe, expect, it } from 'vitest';
import { isContentListFile, stripHiddenItems } from './hiddenContent';

describe('stripHiddenItems', () => {
  it('drops hidden items and keeps the rest in order', () => {
    const json = JSON.stringify([{ id: 'a' }, { id: 'b', hidden: true }, { id: 'c', hidden: false }]);
    expect(JSON.parse(stripHiddenItems(json))).toEqual([{ id: 'a' }, { id: 'c', hidden: false }]);
  });
});

describe('isContentListFile', () => {
  it('matches the six list files, with or without a query or Windows separators', () => {
    expect(isContentListFile('/repo/content/news.json')).toBe(true);
    expect(isContentListFile('/repo/content/publications.json?import')).toBe(true);
    expect(isContentListFile('C:\\repo\\content\\awards.json')).toBe(true);
  });

  it('leaves other JSON alone', () => {
    expect(isContentListFile('/repo/content/profile.json')).toBe(false);
    expect(isContentListFile('/repo/views/__fixtures__/content.json')).toBe(false);
    expect(isContentListFile('/repo/content/news.ts')).toBe(false);
  });
});
```

Run: `npx vitest run lib/hiddenContent.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 2：实现 `lib/hiddenContent.ts`**

```ts file=lib/hiddenContent.ts
const LIST_FILE = /[\\/]content[\\/](news|experiences|publications|projects|talks|awards)\.json$/;

/** True for the content files that hold lists of hideable items. */
export const isContentListFile = (id: string): boolean => LIST_FILE.test(id.split('?')[0]);

/** Removes items marked hidden, so they never reach the bundle visitors download. */
export function stripHiddenItems(json: string): string {
  const items = JSON.parse(json) as { hidden?: boolean }[];
  return JSON.stringify(items.filter((item) => !item.hidden));
}
```

- [ ] **Step 3：在 `vite.config.ts` 中注册插件**

把

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
```

替换为

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { isContentListFile, stripHiddenItems } from './lib/hiddenContent';

export default defineConfig({
  plugins: [
    react(),
    {
      // Hidden items stay in content/*.json (the edit mode reads them from GitHub)
      // but are dropped before bundling, so visitors never download them.
      name: 'strip-hidden-content',
      enforce: 'pre',
      transform(code, id) {
        return isContentListFile(id) ? stripHiddenItems(code) : null;
      },
    },
  ],
```

- [ ] **Step 4：运行测试，并检查构建产物**

Run: `npx vitest run lib/hiddenContent.test.ts && npm test && npx tsc`
Expected：`3 passed`；全部测试通过；`tsc` 无输出。

然后临时隐藏一条内容并构建，检查它没有进入产物：

```bash
cp content/talks.json <SCRATCH>/talks.backup.json
node -e "const f='content/talks.json';const d=JSON.parse(require('fs').readFileSync(f,'utf8'));d[0].hidden=true;require('fs').writeFileSync(f,JSON.stringify(d,null,2)+'\n')"
npm run build > /dev/null
grep -c "Natural Language Processing (NLP)" dist/assets/*.js
cp <SCRATCH>/talks.backup.json content/talks.json
npm run build > /dev/null
grep -c "Natural Language Processing (NLP)" dist/assets/index-*.js
git status --short content
```

Expected：
- 第一次 `grep` 对每个文件都输出 `0`：隐藏的报告不在任何产物里。
- 恢复后的 `grep` 输出 `1`：说明插件只剔除隐藏条目，正常内容照常打包。
- `git status` 没有输出：内容文件已经复原。

- [ ] **Step 5：提交**

```bash
git add lib/hiddenContent.ts lib/hiddenContent.test.ts vite.config.ts
git commit -m "build: drop hidden items from the bundle visitors download

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3：页面上过滤和标注隐藏条目

**Files:**
- Modify: `components/EditMode.tsx`、`components/ListItem.tsx`
- Modify: `views/About.tsx`、`views/Experiences.tsx`、`views/Publications.tsx`、`views/Projects.tsx`、`views/Awards.tsx`、`views/Talks.tsx`、`views/CV.tsx`
- Test: `views/hidden.test.tsx`

**Interfaces:**
- Consumes：`hidden` 字段（Task 1）。
- Produces：
  - `useVisibleItems<T extends { hidden?: boolean }>(items: T[]): T[]`：编辑中返回全部条目，否则只返回可见条目。
  - `HiddenBadge`："已隐藏"标签。
  - `ListItem` 的 `hidden?: boolean` 属性。

- [ ] **Step 1：编写失败的测试**

```tsx file=views/hidden.test.tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ContentContext } from '../components/ContentContext';
import { EditModeContext, EditModeValue } from '../components/EditMode';
import { SiteContent } from '../types';
import fixture from './__fixtures__/content.json';
import About from './About';
import Awards from './Awards';
import CV from './CV';
import Experiences from './Experiences';
import Projects from './Projects';
import Publications from './Publications';
import Talks from './Talks';

const base = fixture as SiteContent;
const hideFirst = <T extends { hidden?: boolean }>(items: T[]): T[] =>
  items.map((item, index) => (index === 0 ? { ...item, hidden: true } : item));

// The first item of every list is hidden.
const content: SiteContent = {
  ...base,
  news: hideFirst(base.news),
  experiences: hideFirst(base.experiences),
  publications: hideFirst(base.publications),
  projects: hideFirst(base.projects),
  talks: hideFirst(base.talks),
  awards: hideFirst(base.awards),
};

const editing: EditModeValue = { editing: true, loggedIn: true, canLogin: true, open: () => {}, login: () => {} };

const render = (View: React.ComponentType, mode?: EditModeValue): string =>
  renderToStaticMarkup(
    <ContentContext.Provider value={content}>
      {mode ? (
        <EditModeContext.Provider value={mode}>
          <View />
        </EditModeContext.Provider>
      ) : (
        <View />
      )}
    </ContentContext.Provider>,
  );

const CASES: { name: string; View: React.ComponentType; hiddenText: string }[] = [
  { name: 'About', View: About, hiddenText: base.news[0].content },
  { name: 'Experiences', View: Experiences, hiddenText: base.experiences[0].title },
  { name: 'Publications', View: Publications, hiddenText: base.publications[0].title },
  { name: 'Projects', View: Projects, hiddenText: base.projects[0].title },
  { name: 'Talks', View: Talks, hiddenText: base.talks[0].title },
  { name: 'Awards', View: Awards, hiddenText: base.awards[0].title },
];

describe('hidden items', () => {
  for (const { name, View, hiddenText } of CASES) {
    it(`${name} leaves hidden items out for visitors`, () => {
      const html = render(View);
      expect(html).not.toContain(hiddenText);
      expect(html).not.toContain('已隐藏');
    });

    it(`${name} shows hidden items, marked, while editing`, () => {
      const html = render(View, editing);
      expect(html).toContain(hiddenText);
      expect(html).toContain('已隐藏');
      expect(html).toContain('opacity-50');
    });
  }

  it('keeps hidden items off the CV, even while editing', () => {
    for (const mode of [undefined, editing]) {
      const html = render(CV, mode);
      expect(html).not.toContain(base.publications[0].title);
      expect(html).not.toContain(base.projects[0].title);
      expect(html).not.toContain(base.talks[0].title);
    }
  });
});
```

Run: `npx vitest run views/hidden.test.tsx`
Expected: FAIL（访客视角下隐藏条目仍然出现；`EditModeValue` 已存在，但页面还没有过滤）。

- [ ] **Step 2：在 `components/EditMode.tsx` 中加入 `useVisibleItems` 和 `HiddenBadge`**

把

```tsx
import { ArrowUpDown, Pencil, Plus, X } from 'lucide-react';
```

替换为

```tsx
import { ArrowUpDown, EyeOff, Pencil, Plus, X } from 'lucide-react';
```

把

```tsx
export const useEditMode = (): EditModeValue => useContext(EditModeContext);
```

替换为

```tsx
export const useEditMode = (): EditModeValue => useContext(EditModeContext);

/** Items to show: everything while editing (hidden ones get marked), only visible ones otherwise. */
export function useVisibleItems<T extends { hidden?: boolean }>(items: T[]): T[] {
  const { editing } = useEditMode();
  return useMemo(() => (editing ? items : items.filter((item) => !item.hidden)), [editing, items]);
}

export const HiddenBadge: React.FC = () => (
  <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 align-middle text-[10px] font-medium normal-case tracking-normal text-gray-500">
    <EyeOff size={11} />
    已隐藏
  </span>
);
```

- [ ] **Step 3：`components/ListItem.tsx` 支持 `hidden`**

把

```tsx
import { EditButton } from './EditMode';
```

替换为

```tsx
import { EditButton, HiddenBadge } from './EditMode';
```

把

```tsx
  editRequest?: EditRequest; // Shows a pencil in edit mode
}
```

替换为

```tsx
  editRequest?: EditRequest; // Shows a pencil in edit mode
  hidden?: boolean; // Hidden from visitors; only rendered in edit mode, faded and labelled
}
```

把

```tsx
  sideContent,
  editRequest
}) => {
  return (
    <div className="group relative flex flex-col sm:flex-row gap-6 p-4 mb-6 hover:bg-gray-50 rounded-lg transition-colors duration-300">
```

替换为

```tsx
  sideContent,
  editRequest,
  hidden
}) => {
  return (
    <div className={`group relative flex flex-col sm:flex-row gap-6 p-4 mb-6 hover:bg-gray-50 rounded-lg transition-colors duration-300${hidden ? ' opacity-50' : ''}`}>
```

把

```tsx
          {title}
        </h3>
```

替换为

```tsx
          {title}
          {hidden && <HiddenBadge />}
        </h3>
```

- [ ] **Step 4：各页面使用 `useVisibleItems`**

`views/About.tsx`：把

```tsx
import { AddButton, EditButton, ReorderButton } from '../components/EditMode';
```

替换为

```tsx
import { AddButton, EditButton, HiddenBadge, ReorderButton, useVisibleItems } from '../components/EditMode';
```

把

```tsx
  const { profile, news } = useContent();
```

替换为

```tsx
  const { profile, news: allNews } = useContent();
  const news = useVisibleItems(allNews);
```

把

```tsx
            <div key={item.id} className="flex flex-col sm:flex-row gap-2 sm:gap-8 text-sm">
```

替换为

```tsx
            <div key={item.id} className={`flex flex-col sm:flex-row gap-2 sm:gap-8 text-sm${item.hidden ? ' opacity-50' : ''}`}>
```

把

```tsx
              <div className="text-gray-600" dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(item.content) }} />
              <EditButton
```

替换为

```tsx
              <div className="text-gray-600" dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(item.content) }} />
              {item.hidden && <HiddenBadge />}
              <EditButton
```

`views/Experiences.tsx`：把

```tsx
import { AddButton, ReorderButton } from '../components/EditMode';
```

替换为

```tsx
import { AddButton, ReorderButton, useVisibleItems } from '../components/EditMode';
```

把

```tsx
  const { experiences } = useContent();
```

替换为

```tsx
  const experiences = useVisibleItems(useContent().experiences);
```

把

```tsx
                    editRequest={{ kind: 'edit', collection: 'experiences', id: exp.id }}
```

替换为

```tsx
                    editRequest={{ kind: 'edit', collection: 'experiences', id: exp.id }}
                    hidden={exp.hidden}
```

`views/Publications.tsx`：把

```tsx
import { AddButton } from '../components/EditMode';
```

替换为

```tsx
import { AddButton, useVisibleItems } from '../components/EditMode';
```

把

```tsx
  const { publications } = useContent();
```

替换为

```tsx
  const publications = useVisibleItems(useContent().publications);
```

把

```tsx
                          editRequest={{ kind: 'edit', collection: 'publications', id: pub.id }}
```

替换为

```tsx
                          editRequest={{ kind: 'edit', collection: 'publications', id: pub.id }}
                          hidden={pub.hidden}
```

`views/Projects.tsx`：把

```tsx
import { AddButton } from '../components/EditMode';
```

替换为

```tsx
import { AddButton, useVisibleItems } from '../components/EditMode';
```

把

```tsx
  const { projects } = useContent();
```

替换为

```tsx
  const projects = useVisibleItems(useContent().projects);
```

把

```tsx
                  editRequest={{ kind: 'edit', collection: 'projects', id: proj.id }}
```

替换为

```tsx
                  editRequest={{ kind: 'edit', collection: 'projects', id: proj.id }}
                  hidden={proj.hidden}
```

`views/Awards.tsx`：把

```tsx
import { AddButton } from '../components/EditMode';
```

替换为

```tsx
import { AddButton, useVisibleItems } from '../components/EditMode';
```

把

```tsx
  const { awards } = useContent();
```

替换为

```tsx
  const awards = useVisibleItems(useContent().awards);
```

把

```tsx
                    editRequest={{ kind: 'edit', collection: 'awards', id: award.id }}
```

替换为

```tsx
                    editRequest={{ kind: 'edit', collection: 'awards', id: award.id }}
                    hidden={award.hidden}
```

`views/Talks.tsx`：把

```tsx
import { AddButton, EditButton, ReorderButton } from '../components/EditMode';
```

替换为

```tsx
import { AddButton, EditButton, HiddenBadge, ReorderButton, useVisibleItems } from '../components/EditMode';
```

把

```tsx
  const { talks } = useContent();
```

替换为

```tsx
  const talks = useVisibleItems(useContent().talks);
```

把

```tsx
          <div key={talk.id} className="bg-white border-l-4 border-purple-500 shadow-sm hover:shadow-md transition-shadow p-6 rounded-r-lg">
```

替换为

```tsx
          <div key={talk.id} className={`bg-white border-l-4 border-purple-500 shadow-sm hover:shadow-md transition-shadow p-6 rounded-r-lg${talk.hidden ? ' opacity-50' : ''}`}>
```

把

```tsx
              {talk.title}
            </h3>
```

替换为

```tsx
              {talk.title}
              {talk.hidden && <HiddenBadge />}
            </h3>
```

`views/CV.tsx`：把

```tsx
  const { profile, publications, projects, talks } = useContent();
```

替换为

```tsx
  const content = useContent();
  const { profile } = content;
  // The CV is for printing, so hidden items never appear on it, not even while editing.
  const publications = content.publications.filter((item) => !item.hidden);
  const projects = content.projects.filter((item) => !item.hidden);
  const talks = content.talks.filter((item) => !item.hidden);
```

- [ ] **Step 5：运行测试，确认通过且快照不变**

Run: `npm test && npx tsc && git status --short views/__snapshots__`
Expected：
- 全部测试通过，其中 `views/hidden.test.tsx` 为 `13 passed`；
- `tsc` 无输出；
- 快照目录没有任何改动。

- [ ] **Step 6：提交**

```bash
git add components/EditMode.tsx components/ListItem.tsx views
git commit -m "feat: leave hidden items out for visitors and mark them in edit mode

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4：编辑弹窗的"隐藏 / 取消隐藏"按钮

**Files:**
- Modify: `editor/components/ItemModal.tsx`、`editor/components/ReorderModal.tsx`

**Interfaces:**
- Consumes：`setHidden` 操作、`commitMessage('hide' | 'unhide', …)`（Task 1）。

- [ ] **Step 1：`editor/components/ItemModal.tsx`**

把

```tsx
import { Trash2 } from 'lucide-react';
```

替换为

```tsx
import { Eye, EyeOff, Trash2 } from 'lucide-react';
```

把

```tsx
  const dirty = JSON.stringify(state) !== JSON.stringify(initial);
```

替换为

```tsx
  const dirty = JSON.stringify(state) !== JSON.stringify(initial);
  const isHidden = form.item.hidden === true;
```

把

```tsx
  const setField = (key: string, value: unknown) => {
```

替换为

```tsx
  // Hiding acts on the stored item, like delete; unsaved form changes are dropped after confirmation.
  const toggleHidden = () => {
    if (request.kind !== 'edit') return;
    if (dirty && !window.confirm('放弃未保存的修改？')) return;
    void submit(
      { kind: 'setHidden', collection: request.collection, id: request.id, hidden: !isHidden },
      [],
      commitMessage(isHidden ? 'unhide' : 'hide', itemNoun(request.collection), form.schema.label(form.item)),
    );
  };

  const setField = (key: string, value: unknown) => {
```

把

```tsx
              <Trash2 size={14} />
              删除
            </button>
          )}
```

替换为

```tsx
              <Trash2 size={14} />
              删除
            </button>
          )}
          {request.kind === 'edit' && (
            <button
              type="button"
              disabled={saving}
              onClick={toggleHidden}
              className="ml-3 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              {isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
              {isHidden ? '取消隐藏' : '隐藏'}
            </button>
          )}
```

把

```tsx
      {saveError && (
        <div role="alert" className="mb-4 p-3 rounded-md bg-red-50 text-sm text-red-700">
          {saveError}
        </div>
      )}
      {visibleFields(form.schema, state).map((field) => (
```

替换为

```tsx
      {saveError && (
        <div role="alert" className="mb-4 p-3 rounded-md bg-red-50 text-sm text-red-700">
          {saveError}
        </div>
      )}
      {isHidden && <div className="mb-4 p-3 rounded-md bg-gray-50 text-sm text-gray-600">这一条目前对访客隐藏。</div>}
      {visibleFields(form.schema, state).map((field) => (
```

- [ ] **Step 2：`editor/components/ReorderModal.tsx` 标注隐藏条目**

把

```tsx
            <span className="flex-1 text-sm text-gray-800 line-clamp-2">{schema.label(byId.get(id) ?? {})}</span>
```

替换为

```tsx
            <span className="flex-1 text-sm text-gray-800 line-clamp-2">
              {schema.label(byId.get(id) ?? {})}
              {byId.get(id)?.hidden === true && <span className="ml-2 text-xs text-gray-400">已隐藏</span>}
            </span>
```

- [ ] **Step 3：类型检查、测试并提交**

Run: `npx tsc && npm test`
Expected：`tsc` 无输出；全部测试通过。

```bash
git add editor/components/ItemModal.tsx editor/components/ReorderModal.tsx
git commit -m "feat: add hide and unhide next to delete in the edit dialog

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5：浏览器验证、文档与上线

- [ ] **Step 1：在模拟模式下验证**

用 `preview_start`（name: `dev-mock`）打开 `http://localhost:3000/`，点页脚锁形图标登录后，逐项检查：

1. **隐藏**：
   - 在 Talks 页打开第一场报告的编辑弹窗，底部应该是"删除 ｜ 隐藏"；
   - 点"隐藏"后弹窗关闭，这场报告变成半透明，标题旁出现"已隐藏"；
   - 控制台的 `[mock commit]` 显示 `content: hide talk "…"`。
2. **预览开关**：关闭管理栏的"编辑模式"开关，这场报告消失；打开后重新出现。
3. **取消隐藏**：
   - 再次打开它的编辑弹窗，顶部显示"这一条目前对访客隐藏。"，按钮显示"取消隐藏"；
   - 点击后恢复正常显示，日志为 `content: unhide talk "…"`。
4. **未保存的修改**：改动某个字段后点"隐藏"，弹出"放弃未保存的修改？"。用 `window.confirm` 替身回答"否"时弹窗保留。
5. **排序弹窗**：隐藏一条新闻后，新闻的排序弹窗里这条带"已隐藏"标注。
6. **年份分组**：Publications 页隐藏 2026 年的两篇论文，然后关闭编辑模式开关，2026 年份标题消失。

- [ ] **Step 2：更新文档**

在 `README.md` 中，把

```markdown
- 列表里的每一条都需要一个不重复的 `id`。
```

替换为

```markdown
- 列表里的每一条都需要一个不重复的 `id`。
- 条目加上 `"hidden": true` 后不会在网站上显示，但仍然保留在仓库里，也可以在编辑模式里取消隐藏。仓库是公开的，隐藏不等于保密。
```

在 `docs/admin-setup.md` 中，把

```markdown
- 登录 8 小时后过期，再点一次登录即可，不需要重新授权。
```

替换为

```markdown
- 登录 8 小时后过期，再点一次登录即可，不需要重新授权。
- 编辑弹窗里的"隐藏"可以让条目暂时不对访客显示，编辑模式下它会变成半透明并带"已隐藏"标签，随时可以取消隐藏。仓库是公开的，需要保密的内容请删除。
```

```bash
git add README.md docs/admin-setup.md
git commit -m "docs: explain hidden items

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3：上线**

用户已同意"直接做并上线"。

```bash
git fetch origin
git merge --ff-only origin/main
npm test && npm run build
git checkout main && git merge --ff-only feat/inline-edit-mode && git push origin main && git checkout feat/inline-edit-mode
```

如果 `origin/main` 上有用户在网页编辑器里产生的新提交，第一步的快进合并会把它们带进功能分支；如果无法快进，就停下来排查。

然后用 `gh run list --workflow deploy.yml --limit 1 --json databaseId,headSha,status` 找到本次运行，执行 `gh run watch <id> --exit-status`，最后确认线上资源已更新。
