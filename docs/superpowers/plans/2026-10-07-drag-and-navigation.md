# 拖拽排序与导航编辑 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 编辑模式下，页面上的条目可以拖拽排序（拖动时卡片浮起）；导航栏可以新增自定义页面或外部链接，也可以删除、隐藏、改名和排序。

**Architecture:**
- **拖拽**：用 `@dnd-kit` 实现，代码只在编辑模式下按需加载。主包里的 `SortableGroup` 在非编辑状态下输出和原来完全相同的列表容器。
- **保存**：松手后立即在页面上显示新顺序，再把 `reorder` 操作放进 EditorRoot 的保存队列，依次提交。
- **导航**：导航变成新的内容集合 `navigation`，路由和导航栏都根据它生成，在导航设置弹窗里编辑。

**Tech Stack:** React 18 · TypeScript 5.9 · @dnd-kit/core 6.3 · @dnd-kit/sortable 10 · @dnd-kit/utilities 3.2 · react-router-dom 6.30 · Vitest 3.2

**规格：** `docs/superpowers/specs/2026-10-07-drag-and-navigation-design.md`

## Global Constraints

- **访客视角零变化**：
  - 已有页面快照（`views/__snapshots__/`）必须保持不变；
  - 导航栏的链接文字、顺序和样式与现在一致（cv 是隐藏项）；
  - 唯一的变化：cv 隐藏后，访客直接打开 `#/cv` 会回到首页（导航栏里本来就没有它）。
- **按需加载**：
  - 拖拽库只能出现在按需加载的编辑器 chunk 里，不能进入主包 `index-*.js`；
  - 模拟后端仍然不能进入任何产物。
- **提交与保存**：
  - 每次拖拽、每个导航操作都立即保存，各对应一次提交；
  - 提交信息格式为 `content: reorder <集合>`，以及 `content: <add|update|delete|hide|unhide> nav item "<名称>"`。
- **首页**：about 不能删除或隐藏，只能改名。
- **界面文字用中文**：
  - 把手的提示和名称都是"拖动排序"；
  - 导航栏末尾的按钮是"编辑导航"，弹窗标题是"导航设置"；
  - 类型标签是"首页 / 内置页面 / 自定义页面 / 外部链接"，隐藏的再加"· 已隐藏"。
- **代码提交信息**：用英文，结尾带 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- **新文件**：带 `file=路径` 的代码块是新文件的完整内容（或整体替换），可以用 scratchpad 里的 `extract-plan.mjs` 写出。

---

## 文件结构

| 路径 | 职责 | 包 |
|---|---|---|
| `types.ts` | `BUILTIN_PAGES`、`BuiltinPage`、`NavItem`；`SiteContent.navigation`；`ListCollection` 加 `'navigation'`；`EditRequest` 去掉 `reorder`、加 `navigation` | 共用 |
| `content/navigation.json`、`content/index.ts` | 导航数据及其加载 | 主包 |
| `lib/markdown.ts` | 新增 `renderMarkdown`（块级） | 主包 |
| `lib/hiddenContent.ts` | 构建剔除范围加上 `navigation.json` | 构建 |
| `editor/ops.ts` | `upsert` 支持 `at: 'start' \| 'end'`；`navigation` 的名词 | 编辑器 |
| `editor/schemas.ts` | `NAV_SCHEMAS`、`listSchema()`、`slugify()`、`newItem(schema, preset)`、`Field.rows`、`ListSchema.unique` | 编辑器 |
| `editor/backend.ts` | 加载时读取 8 个集合 | 编辑器 |
| `editor/components/ItemModal.tsx` | 按条目类型选表单；首页锁定；唯一性校验；导航新增项追加到末尾 | 编辑器 |
| `editor/dnd/SortableList.tsx` | 通用拖拽列表（把手、占位框、浮层） | 拖拽 chunk |
| `editor/dnd/SortableGroupImpl.tsx` | 页面列表在编辑模式下的实现 | 拖拽 chunk |
| `components/SortableGroup.tsx` | 主包入口：非编辑状态下是普通列表，编辑状态下懒加载实现 | 主包 |
| `components/EditMode.tsx` | `EditModeValue` 增加 `ready`、`reorder`；删除 `ReorderButton` | 主包 |
| `editor/EditorRoot.tsx` | 保存队列、`reorder`、`ready`、导航设置弹窗 | 编辑器 |
| `components/pages.ts`、`components/SiteRoutes.tsx`、`components/CustomPage.tsx`、`components/Navbar.tsx`、`App.tsx` | 内置页面注册表、按导航数据生成的路由、自定义页面、导航栏、布局 | 主包 |
| `editor/components/NavigationModal.tsx` | 导航设置弹窗 | 编辑器 |
| `editor/components/Modal.tsx` | 只有最上层弹窗响应 Esc | 编辑器 |
| `views/*.tsx` | 列表改用 `SortableGroup`；去掉排序按钮；论文只按年份排序 | 主包 |
| `editor/components/ReorderModal.tsx` | 删除 | — |

---

### Task 1：导航数据模型、内容操作与表单

**Files:**
- Modify: `types.ts`、`content/index.ts`、`lib/hiddenContent.ts`、`editor/backend.ts`、`editor/ops.ts`、`editor/schemas.ts`、`editor/components/fields.tsx`、`views/__fixtures__/content.json`
- Create: `content/navigation.json`
- Replace: `editor/components/ItemModal.tsx`
- Test: `lib/hiddenContent.test.ts`、`editor/backend.test.ts`、`editor/ops.test.ts`、`editor/schemas.test.ts`

**Interfaces:**
- Produces（`types.ts`）：
  - `BUILTIN_PAGES`（只读数组）、`BuiltinPage`、`NavItem`（`builtin` / `page` / `link` 三种）；
  - `SiteContent.navigation: NavItem[]`；
  - `ListCollection` 包含 `'navigation'`。
- Produces（`editor/ops.ts`）：`upsert` 操作增加可选的 `at?: 'start' | 'end'`。
- Produces（`editor/schemas.ts`）：
  - `NAV_SCHEMAS: Record<NavItem['type'], ListSchema>`；
  - `listSchema(collection: ListCollection, item: Values): ListSchema`；
  - `slugify(text: string): string`；
  - `newItem(schema: ListSchema, preset?: Values): Values`；
  - `Field.rows?: number`、`ListSchema.unique?: Record<string, string>`（字段名 → 重复时的提示）；
  - `LIST_SCHEMAS` 的键改为 `Exclude<ListCollection, 'navigation'>`。
- Produces（`ItemModal.tsx`）：`FormRequest = Extract<EditRequest, { kind: 'edit' | 'add' | 'profile' }>`。

- [ ] **Step 1：编写失败的测试**

`editor/ops.test.ts`：在 `it('does not change the input list', …)` 之前加入：

```ts
  it('appends new items at the end when asked', () => {
    expect(ids(applyListOp(list, { kind: 'upsert', collection: 'navigation', item: { id: 'new' }, at: 'end' }))).toEqual([
      'a',
      'b',
      'c',
      'd',
      'new',
    ]);
  });
```

`lib/hiddenContent.test.ts`：把

```ts
    expect(isContentListFile('/repo/content/publications.json?import')).toBe(true);
```

替换为

```ts
    expect(isContentListFile('/repo/content/publications.json?import')).toBe(true);
    expect(isContentListFile('/repo/content/navigation.json')).toBe(true);
```

`editor/backend.test.ts`：把 `expect(api.readText).toHaveBeenCalledTimes(7);` 替换为 `expect(api.readText).toHaveBeenCalledTimes(8);`。

`editor/schemas.test.ts`：把导入改为

```ts
import {
  LIST_SCHEMAS,
  NAV_SCHEMAS,
  PROFILE_SCHEMAS,
  fromFormState,
  listSchema,
  newItem,
  profileFields,
  toFormState,
  validateForm,
} from './schemas';
```

把 `const item = newItem('publications');` 替换为 `const item = newItem(LIST_SCHEMAS.publications);`，并在文件末尾追加：

```ts
describe('navigation forms', () => {
  it('picks the form by entry type', () => {
    expect(listSchema('navigation', { type: 'link' })).toBe(NAV_SCHEMAS.link);
    expect(listSchema('navigation', { type: 'builtin' })).toBe(NAV_SCHEMAS.builtin);
    expect(listSchema('talks', {})).toBe(LIST_SCHEMAS.talks);
  });

  it('needs an http(s) address for links', () => {
    const schema = NAV_SCHEMAS.link;
    expect(validateForm(schema, { label: 'scholar', url: 'scholar.google.com' })).toEqual({
      url: '请填写以 http:// 或 https:// 开头的网址',
    });
    expect(validateForm(schema, { label: 'scholar', url: 'https://scholar.google.com' })).toEqual({});
  });

  it('checks page addresses and derives one from the label when left empty', () => {
    const schema = NAV_SCHEMAS.page;
    expect(validateForm(schema, { label: 'x', title: 'X', slug: 'Bad Slug', body: '' })).toEqual({
      slug: '只能用小写字母、数字和连字符，例如 teaching',
    });
    const page = newItem(schema, { type: 'page' });
    expect(String(page.id)).toMatch(/^page-/);
    const { item } = fromFormState(schema, { label: 'Teaching Notes', title: 'Teaching', slug: '', body: '## Hi' }, page, now);
    expect(item).toMatchObject({ type: 'page', label: 'Teaching Notes', title: 'Teaching', slug: 'teaching-notes', body: '## Hi' });
  });

  it('falls back to the id for labels without ASCII letters, and keeps an empty body', () => {
    const { item } = fromFormState(NAV_SCHEMAS.page, { label: '教学', title: '教学', slug: '', body: '' }, { id: 'page-abc', type: 'page' }, now);
    expect(item.slug).toBe('page-abc');
    expect(item.body).toBe('');
  });
});
```

Run: `npx vitest run editor/ops.test.ts lib/hiddenContent.test.ts editor/schemas.test.ts editor/backend.test.ts`
Expected：FAIL（`NAV_SCHEMAS`、`listSchema` 不存在；`navigation.json` 没被识别；只读取了 7 个集合）。

- [ ] **Step 2：`types.ts`**

把

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

export type ListCollection = 'news' | 'experiences' | 'publications' | 'projects' | 'talks' | 'awards';
```

替换为

```ts
export const BUILTIN_PAGES = ['about', 'experiences', 'publications', 'projects', 'talks', 'awards', 'cv'] as const;
export type BuiltinPage = (typeof BUILTIN_PAGES)[number];

interface NavBase extends Hideable {
  id: string;
  /** Text shown in the navigation bar. */
  label: string;
}

/** One entry of the navigation bar; the array order is the bar's order. */
export type NavItem =
  | (NavBase & { type: 'builtin'; page: BuiltinPage })
  | (NavBase & { type: 'page'; slug: string; title: string; body: string })
  | (NavBase & { type: 'link'; url: string });

export interface SiteContent {
  profile: Profile;
  news: NewsItem[];
  experiences: Experience[];
  publications: Publication[];
  projects: Project[];
  talks: Talk[];
  awards: Award[];
  navigation: NavItem[];
}

export type ListCollection = 'news' | 'experiences' | 'publications' | 'projects' | 'talks' | 'awards' | 'navigation';
```

- [ ] **Step 3：导航数据**

```bash
node -e "
const nav = [
  ...['about', 'experiences', 'publications', 'projects', 'talks', 'awards'].map((page) => ({ id: page, type: 'builtin', page, label: page })),
  { id: 'cv', type: 'builtin', page: 'cv', label: 'cv', hidden: true },
];
const fs = require('fs');
fs.writeFileSync('content/navigation.json', JSON.stringify(nav, null, 2) + '\n');
const f = 'views/__fixtures__/content.json';
const fixture = JSON.parse(fs.readFileSync(f, 'utf8'));
fixture.navigation = nav;
fs.writeFileSync(f, JSON.stringify(fixture, null, 2) + '\n');
"
```

`content/index.ts`：把

```ts
import { Award, Experience, NewsItem, Profile, Project, Publication, SiteContent, Talk } from '../types';
import awards from './awards.json';
import experiences from './experiences.json';
```

替换为

```ts
import { Award, Experience, NavItem, NewsItem, Profile, Project, Publication, SiteContent, Talk } from '../types';
import awards from './awards.json';
import experiences from './experiences.json';
import navigation from './navigation.json';
```

把

```ts
  awards: awards as Award[],
```

替换为

```ts
  awards: awards as Award[],
  // JSON infers plain strings for the entry types, so this union needs the cast through unknown.
  navigation: navigation as unknown as NavItem[],
```

- [ ] **Step 4：构建剔除、加载和内容操作**

`lib/hiddenContent.ts`：把 `(news|experiences|publications|projects|talks|awards)` 替换为 `(news|experiences|publications|projects|talks|awards|navigation)`。

`editor/backend.ts`：把

```ts
const COLLECTIONS = ['profile', 'news', 'experiences', 'publications', 'projects', 'talks', 'awards'] as const;
```

替换为

```ts
const COLLECTIONS = ['profile', 'news', 'experiences', 'publications', 'projects', 'talks', 'awards', 'navigation'] as const;
```

`editor/ops.ts`：把

```ts
  | { kind: 'upsert'; collection: ListCollection; item: ListItem }
```

替换为

```ts
  | { kind: 'upsert'; collection: ListCollection; item: ListItem; at?: 'start' | 'end' }
```

把

```ts
      return index === -1 ? [item, ...list] : list.map((entry, i) => (i === index ? item : entry));
```

替换为

```ts
      if (index !== -1) return list.map((entry, i) => (i === index ? item : entry));
      return op.at === 'end' ? [...list, item] : [item, ...list];
```

把

```ts
  awards: 'award',
};
```

替换为

```ts
  awards: 'award',
  navigation: 'nav item',
};
```

- [ ] **Step 5：`editor/schemas.ts`**

把

```ts
import { ListCollection, Profile, ProfileSection, Rank } from '../types';
```

替换为

```ts
import { ListCollection, NavItem, Profile, ProfileSection, Rank } from '../types';
```

把

```ts
  pattern?: { regex: RegExp; message: string };
  showIf?: (state: FormState) => boolean;
}
```

替换为

```ts
  pattern?: { regex: RegExp; message: string };
  showIf?: (state: FormState) => boolean;
  /** Height of textareas, overriding the default for the field type. */
  rows?: number;
}
```

把

```ts
export interface ListSchema extends FormSchema {
  addTitle: string;
  idPrefix: string;
}
```

替换为

```ts
export interface ListSchema extends FormSchema {
  addTitle: string;
  idPrefix: string;
  /** Keys whose value must differ from every other item in the list, with the message shown otherwise. */
  unique?: Record<string, string>;
}
```

把

```ts
export const LIST_SCHEMAS: Record<ListCollection, ListSchema> = {
```

替换为

```ts
export const LIST_SCHEMAS: Record<Exclude<ListCollection, 'navigation'>, ListSchema> = {
```

把

```ts
export function newItem(collection: ListCollection, preset: Values = {}): Values {
  const schema = LIST_SCHEMAS[collection];
  return { id: `${schema.idPrefix}-${Date.now().toString(36)}`, ...schema.defaults?.(), ...preset };
}
```

替换为

```ts
export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const SLUG = { regex: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, message: '只能用小写字母、数字和连字符，例如 teaching' };
const WEB_ADDRESS = { regex: /^https?:\/\/\S+$/i, message: '请填写以 http:// 或 https:// 开头的网址' };
const BODY_HELP =
  '支持 ## 小标题、- 列表、1. 编号列表、[文字](链接)、**加粗**；单独一行的 ![说明](图片地址) 会显示图片；空行分段';

export const NAV_SCHEMAS: Record<NavItem['type'], ListSchema> = {
  builtin: {
    addTitle: '恢复页面',
    editTitle: '编辑导航项',
    idPrefix: 'nav',
    label: (item) => text(item.label),
    fields: [{ key: 'label', label: '导航名称', type: 'text', required: true }],
  },
  page: {
    addTitle: '新增页面',
    editTitle: '编辑页面',
    idPrefix: 'page',
    label: (item) => text(item.label),
    defaults: () => ({ type: 'page', body: '' }),
    unique: { slug: '这个地址已被其他页面使用' },
    finalize: (item) => ({
      ...item,
      slug: text(item.slug) || slugify(text(item.label)) || String(item.id),
      body: text(item.body),
    }),
    fields: [
      { key: 'label', label: '导航名称', type: 'text', required: true, placeholder: 'teaching' },
      { key: 'title', label: '页面标题', type: 'text', required: true, placeholder: 'teaching' },
      { key: 'slug', label: '页面地址', type: 'text', pattern: SLUG, help: '网址为 #/p/<地址>；留空则根据导航名称生成' },
      { key: 'body', label: '正文', type: 'markdown', rows: 14, help: BODY_HELP },
    ],
  },
  link: {
    addTitle: '新增外部链接',
    editTitle: '编辑外部链接',
    idPrefix: 'link',
    label: (item) => text(item.label),
    defaults: () => ({ type: 'link' }),
    fields: [
      { key: 'label', label: '导航名称', type: 'text', required: true, placeholder: 'scholar' },
      {
        key: 'url',
        label: '网址',
        type: 'text',
        required: true,
        pattern: WEB_ADDRESS,
        placeholder: 'https://scholar.google.com/…',
      },
    ],
  },
};

/** The form for an item of a list; navigation entries use a different form per type. */
export function listSchema(collection: ListCollection, item: Values): ListSchema {
  if (collection === 'navigation') return NAV_SCHEMAS[(item.type as NavItem['type']) ?? 'page'] ?? NAV_SCHEMAS.page;
  return LIST_SCHEMAS[collection];
}

export function newItem(schema: ListSchema, preset: Values = {}): Values {
  return { id: `${schema.idPrefix}-${Date.now().toString(36)}`, ...schema.defaults?.(), ...preset };
}
```

`editor/components/fields.tsx`：把 `rows={TEXTAREA_ROWS[field.type]}` 替换为 `rows={field.rows ?? TEXTAREA_ROWS[field.type]}`。

- [ ] **Step 6：整体替换 `editor/components/ItemModal.tsx`**

```tsx file=editor/components/ItemModal.tsx
import React, { useMemo, useState } from 'react';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { EditRequest, SiteContent } from '../../types';
import { ImageUpload, describeSaveError } from '../backend';
import { ContentOp, ListItem, commitMessage, itemNoun } from '../ops';
import {
  FormSchema,
  FormState,
  PROFILE_SCHEMAS,
  Values,
  fromFormState,
  listSchema,
  newItem,
  profileFields,
  toFormState,
  validateForm,
  visibleFields,
} from '../schemas';
import { FieldControl } from './fields';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, Modal } from './Modal';

export type SaveHandler = (op: ContentOp, uploads: ImageUpload[], message: string) => Promise<void>;

export type FormRequest = Extract<EditRequest, { kind: 'edit' | 'add' | 'profile' }>;

interface ResolvedForm {
  schema: FormSchema;
  item: Values;
  title: string;
  isNew: boolean;
  /** The home page entry can be renamed, but not hidden or deleted. */
  locked: boolean;
  /** Keys whose value must differ from every other item's, with the message shown otherwise. */
  unique: Record<string, string>;
}

function resolveForm(request: FormRequest, content: SiteContent): ResolvedForm | null {
  if (request.kind === 'profile') {
    const schema = PROFILE_SCHEMAS[request.section];
    return { schema, item: content.profile as unknown as Values, title: schema.editTitle, isNew: false, locked: true, unique: {} };
  }
  if (request.kind === 'add') {
    const schema = listSchema(request.collection, request.preset ?? {});
    return { schema, item: newItem(schema, request.preset), title: schema.addTitle, isNew: true, locked: false, unique: schema.unique ?? {} };
  }
  const item = (content[request.collection] as unknown as Values[]).find((entry) => entry.id === request.id);
  if (!item) return null;
  const schema = listSchema(request.collection, item);
  const locked = request.collection === 'navigation' && item.type === 'builtin' && item.page === 'about';
  return { schema, item, title: schema.editTitle, isNew: false, locked, unique: schema.unique ?? {} };
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
  const isHidden = form.item.hidden === true;

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
      return;
    }
    const others = (content[request.collection] as unknown as Values[]).filter((entry) => entry.id !== item.id);
    const taken = Object.entries(form.unique).find(
      ([key]) => item[key] !== undefined && others.some((entry) => entry[key] === item[key]),
    );
    if (taken) {
      setErrors({ [taken[0]]: taken[1] });
      return;
    }
    void submit(
      {
        kind: 'upsert',
        collection: request.collection,
        item: item as ListItem,
        // New navigation entries go to the end of the bar; other new items start their list.
        at: request.collection === 'navigation' ? 'end' : 'start',
      },
      uploads,
      commitMessage(form.isNew ? 'add' : 'update', itemNoun(request.collection), form.schema.label(item)),
    );
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
    setState((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const itemActions = request.kind === 'edit' && !form.locked;

  return (
    <Modal
      title={form.title}
      onClose={close}
      footer={
        <>
          {itemActions && (
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
          {itemActions && (
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
      {isHidden && <div className="mb-4 p-3 rounded-md bg-gray-50 text-sm text-gray-600">这一条目前对访客隐藏。</div>}
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

- [ ] **Step 7：运行全部测试与类型检查**

Run: `npm test && npx tsc`
Expected：全部通过（新增 5 个测试）；`tsc` 无输出；`git status views/__snapshots__` 没有改动。

- [ ] **Step 8：提交**

```bash
git add types.ts content lib/hiddenContent.ts lib/hiddenContent.test.ts editor views/__fixtures__/content.json
git commit -m "feat: add navigation as an editable content collection

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2：块级 Markdown 渲染

**Files:**
- Modify: `lib/markdown.ts`
- Test: `lib/markdown.test.ts`

**Interfaces:**
- Produces：`renderMarkdown(source: string): string`。支持标题、段落、列表和图片，所有 HTML 都会被转义。

- [ ] **Step 1：在 `lib/markdown.test.ts` 末尾追加失败的测试，并把导入改为 `import { renderInlineMarkdown, renderMarkdown } from './markdown';`**

```ts
// Class names are styling; these tests check the structure.
const plain = (html: string): string => html.replace(/ class="[^"]*"/g, '');

describe('renderMarkdown', () => {
  it('renders headings, paragraphs with line breaks, and lists', () => {
    expect(plain(renderMarkdown('## Courses\nFirst line\nsecond line\n\n- One\n- [Two](https://x.org)\n\n1. A\n2. B'))).toBe(
      [
        '<h2>Courses</h2>',
        '<p>First line<br />second line</p>',
        '<ul><li>One</li><li><a href="https://x.org" target="_blank" rel="noreferrer">Two</a></li></ul>',
        '<ol><li>A</li><li>B</li></ol>',
      ].join('\n'),
    );
  });

  it('maps # and ## to h2 and ### to h3', () => {
    expect(plain(renderMarkdown('# A\n### B'))).toBe('<h2>A</h2>\n<h3>B</h3>');
  });

  it('shows standalone images from safe addresses only', () => {
    expect(plain(renderMarkdown('![Me](/images/zzh.png)'))).toBe('<img src="/images/zzh.png" alt="Me" />');
    expect(plain(renderMarkdown('![x](javascript:alert)'))).toBe('<p>x</p>');
  });

  it('escapes HTML everywhere', () => {
    expect(plain(renderMarkdown('<script>alert(1)</script>\n- <b>x</b>'))).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>\n<ul><li>&lt;b&gt;x&lt;/b&gt;</li></ul>',
    );
  });

  it('starts a new list when the list type changes', () => {
    expect(plain(renderMarkdown('- a\n1. b'))).toBe('<ul><li>a</li></ul>\n<ol><li>b</li></ol>');
  });

  it('returns nothing for an empty body', () => {
    expect(renderMarkdown('  \n\n')).toBe('');
  });
});
```

Run: `npx vitest run lib/markdown.test.ts`
Expected: FAIL（`renderMarkdown` 不存在）。

- [ ] **Step 2：在 `lib/markdown.ts` 末尾追加**

```ts
const BLOCK_CLASS = {
  h2: 'text-xl font-bold text-gray-900 mt-8 mb-3',
  h3: 'text-lg font-semibold text-gray-900 mt-6 mb-2',
  p: 'text-gray-700 font-light leading-relaxed mb-4',
  ul: 'list-disc pl-6 mb-4 space-y-1 text-gray-700 font-light',
  ol: 'list-decimal pl-6 mb-4 space-y-1 text-gray-700 font-light',
  img: 'max-w-full h-auto rounded-md my-4',
};

const SAFE_IMAGE = /^(https?:|\/(?!\/)|\.\/)/i;

type ListBlock = { tag: 'ul' | 'ol'; items: string[] };

/**
 * Renders a page body: # / ## / ### headings, - and 1. lists, a standalone ![alt](src) line as an image,
 * and paragraphs separated by blank lines (single line breaks are kept). All other HTML is escaped.
 */
export function renderMarkdown(source: string): string {
  const html: string[] = [];
  const open: { paragraph: string[]; list: ListBlock | null } = { paragraph: [], list: null };

  const closeParagraph = () => {
    if (open.paragraph.length > 0) {
      html.push(`<p class="${BLOCK_CLASS.p}">${open.paragraph.map(renderInlineMarkdown).join('<br />')}</p>`);
    }
    open.paragraph = [];
  };
  const closeList = () => {
    if (open.list) {
      const { tag, items } = open.list;
      html.push(`<${tag} class="${BLOCK_CLASS[tag]}">${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</${tag}>`);
    }
    open.list = null;
  };

  for (const line of source.replace(/\r\n?/g, '\n').split('\n').map((raw) => raw.trim())) {
    if (line === '') {
      closeParagraph();
      closeList();
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      closeParagraph();
      closeList();
      const tag = heading[1].length === 3 ? 'h3' : 'h2';
      html.push(`<${tag} class="${BLOCK_CLASS[tag]}">${renderInlineMarkdown(heading[2])}</${tag}>`);
      continue;
    }
    const image = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(line);
    if (image) {
      closeParagraph();
      closeList();
      const [, alt, src] = image;
      html.push(
        SAFE_IMAGE.test(src)
          ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" class="${BLOCK_CLASS.img}" />`
          : `<p class="${BLOCK_CLASS.p}">${escapeHtml(alt)}</p>`,
      );
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    const listItem = bullet ?? numbered;
    if (listItem) {
      closeParagraph();
      const tag = bullet ? 'ul' : 'ol';
      if (open.list && open.list.tag !== tag) closeList();
      if (!open.list) open.list = { tag, items: [] };
      open.list.items.push(listItem[1]);
      continue;
    }
    closeList();
    open.paragraph.push(line);
  }
  closeParagraph();
  closeList();
  return html.join('\n');
}
```

- [ ] **Step 3：运行测试并提交**

Run: `npx vitest run lib/markdown.test.ts && npx tsc`
Expected：`13 passed`；`tsc` 无输出。

```bash
git add lib/markdown.ts lib/markdown.test.ts
git commit -m "feat: render headings, lists and images for custom pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3：拖拽排序

**Files:**
- Modify: `package.json`、`package-lock.json`（新增 3 个 @dnd-kit 依赖）
- Create: `editor/dnd/SortableList.tsx`、`editor/dnd/SortableGroupImpl.tsx`、`components/SortableGroup.tsx`
- Replace: `editor/EditorRoot.tsx`
- Modify: `components/EditMode.tsx`、`types.ts`、`views/About.tsx`、`views/Experiences.tsx`、`views/Publications.tsx`、`views/Projects.tsx`、`views/Awards.tsx`、`views/Talks.tsx`、`views/__fixtures__/content.json`、`views/hidden.test.tsx`
- Delete: `editor/components/ReorderModal.tsx`

**Interfaces:**
- Consumes：`applyOp`、`commitMessage`（`editor/ops.ts`）；`describeSaveError`（`editor/backend.ts`）。
- Produces：
  - `EditModeValue.ready: boolean`、`EditModeValue.reorder(collection: ListCollection, ids: string[]): void`；
  - `SortableGroup<T>({ collection, items, className, renderItem })`；
  - `SortableList<T>({ items, className, renderItem, onReorder, handleClassName? })`；
  - `EditRequest` 不再有 `reorder`。

- [ ] **Step 1：安装依赖**

```bash
npm install @dnd-kit/core@^6.3.1 @dnd-kit/sortable@^10.0.0 @dnd-kit/utilities@^3.2.2
```

- [ ] **Step 2：拖拽组件**

```tsx file=editor/dnd/SortableList.tsx
import React, { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

export interface SortableListProps<T extends { id: string }> {
  items: T[];
  /** Class of the list container. */
  className: string;
  renderItem: (item: T) => React.ReactNode;
  onReorder: (ids: string[]) => void;
  /** Positions the grip; by default it sits in the page margin left of the item. */
  handleClassName?: string;
}

// Fits the page margin: main has px-6 (24px) on phones and md:px-12 (48px) from 768px up.
const MARGIN_HANDLE = 'absolute top-1/2 -translate-y-1/2 -left-6 md:-left-9';

function SortableRow({ id, handleClassName, children }: { id: string; handleClassName: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // While dragging, the row stays as a dashed placeholder of the same size (an outline does not move the layout).
      className={`relative${isDragging ? ' rounded-lg outline-dashed outline-2 outline-purple-300 bg-purple-50/40' : ''}`}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        title="拖动排序"
        {...attributes}
        {...listeners}
        aria-label="拖动排序"
        className={`${handleClassName} z-20 p-0.5 rounded-md text-gray-300 hover:text-purple-600 hover:bg-purple-50 cursor-grab active:cursor-grabbing touch-none`}
      >
        <GripVertical size={18} />
      </button>
      <div className={isDragging ? 'invisible' : undefined}>{children}</div>
    </div>
  );
}

/** A vertical list reordered by dragging a grip; the dragged item floats above the page while it moves. */
export function SortableList<T extends { id: string }>({
  items,
  className,
  renderItem,
  onReorder,
  handleClassName = MARGIN_HANDLE,
}: SortableListProps<T>) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map((item) => item.id);
  const active = activeId === null ? undefined : items.find((item) => item.id === activeId);

  const onDragStart = ({ active: dragged }: DragStartEvent) => setActiveId(String(dragged.id));
  const onDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || dragged.id === over.id) return;
    onReorder(arrayMove(ids, ids.indexOf(String(dragged.id)), ids.indexOf(String(over.id))));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item) => (
            <SortableRow key={item.id} id={item.id} handleClassName={handleClassName}>
              {renderItem(item)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {active ? (
          <div className="rounded-lg bg-white shadow-2xl ring-1 ring-purple-200 scale-[1.02] -rotate-1 cursor-grabbing">
            {renderItem(active)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
```

```tsx file=editor/dnd/SortableGroupImpl.tsx
import { useEditMode } from '../../components/EditMode';
import type { SortableGroupProps } from '../../components/SortableGroup';
import { SortableList } from './SortableList';

/** Edit-mode body of SortableGroup: drag within the group, saved through the edit mode. */
export default function SortableGroupImpl({ collection, items, className, renderItem }: SortableGroupProps<{ id: string }>) {
  const { reorder } = useEditMode();
  return (
    <SortableList items={items} className={className} renderItem={renderItem} onReorder={(ids) => reorder(collection, ids)} />
  );
}
```

```tsx file=components/SortableGroup.tsx
import React, { Suspense, lazy } from 'react';
import { ListCollection } from '../types';
import { useEditMode } from './EditMode';

export interface SortableGroupProps<T extends { id: string }> {
  collection: ListCollection;
  items: T[];
  /** Class of the list container: the same element visitors get, so their page never changes. */
  className: string;
  renderItem: (item: T) => React.ReactNode;
}

// The drag-and-drop library only loads in edit mode.
const SortableGroupImpl = lazy(() => import('../editor/dnd/SortableGroupImpl'));

/** A list that can be reordered by dragging while editing, and a plain list otherwise. */
export function SortableGroup<T extends { id: string }>({ collection, items, className, renderItem }: SortableGroupProps<T>) {
  const { editing } = useEditMode();
  const plain = (
    <div className={className}>
      {items.map((item) => (
        <React.Fragment key={item.id}>{renderItem(item)}</React.Fragment>
      ))}
    </div>
  );
  if (!editing) return plain;
  return (
    <Suspense fallback={plain}>
      <SortableGroupImpl
        collection={collection}
        items={items}
        className={className}
        renderItem={renderItem as (item: { id: string }) => React.ReactNode}
      />
    </Suspense>
  );
}
```

- [ ] **Step 3：`components/EditMode.tsx`**

把

```tsx
import { ArrowUpDown, EyeOff, Pencil, Plus, X } from 'lucide-react';
import { loginConfigured } from '../editor/config';
import { LoginCallback, MOCK_MODE, Session, loadSession } from '../lib/session';
import { EditRequest } from '../types';
```

替换为

```tsx
import { EyeOff, Pencil, Plus, X } from 'lucide-react';
import { loginConfigured } from '../editor/config';
import { LoginCallback, MOCK_MODE, Session, loadSession } from '../lib/session';
import { EditRequest, ListCollection } from '../types';
```

把

```tsx
  /** Whether to offer the login entry at all. */
  canLogin: boolean;
  open: (request: EditRequest) => void;
  login: () => void;
}
```

替换为

```tsx
  /** Whether to offer the login entry at all. */
  canLogin: boolean;
  /** False only while a signed-in owner's editor is still loading the latest content. */
  ready: boolean;
  open: (request: EditRequest) => void;
  login: () => void;
  /** Saves a new order for some items of a list (drag and drop). */
  reorder: (collection: ListCollection, ids: string[]) => void;
}
```

把

```tsx
  canLogin: false,
  open: noop,
  login: noop,
});
```

替换为

```tsx
  canLogin: false,
  ready: true,
  open: noop,
  login: noop,
  reorder: noop,
});
```

把

```tsx
    () => ({ editing: false, loggedIn: false, canLogin: MOCK_MODE || loginConfigured(), open: noop, login }),
```

替换为

```tsx
    () => ({
      editing: false,
      loggedIn: false,
      canLogin: MOCK_MODE || loginConfigured(),
      ready: true,
      open: noop,
      login,
      reorder: noop,
    }),
```

把

```tsx
  const loading = <EditModeContext.Provider value={{ ...visitor, loggedIn: true }}>{children}</EditModeContext.Provider>;
```

替换为

```tsx
  const loading = (
    <EditModeContext.Provider value={{ ...visitor, loggedIn: true, ready: false }}>{children}</EditModeContext.Provider>
  );
```

删除文件末尾整个 `export const ReorderButton …` 组件（从 `export const ReorderButton` 到文件结尾的 `};`）。

`views/hidden.test.tsx` 里的编辑模式取值也要补上新字段：把

```tsx
const editing: EditModeValue = { editing: true, loggedIn: true, canLogin: true, open: () => {}, login: () => {} };
```

替换为

```tsx
const editing: EditModeValue = {
  editing: true,
  loggedIn: true,
  canLogin: true,
  ready: true,
  open: () => {},
  login: () => {},
  reorder: () => {},
};
```

- [ ] **Step 4：`types.ts` 去掉 `reorder` 请求**

删除这一行：

```ts
  | { kind: 'reorder'; collection: ListCollection; category?: ExperienceCategory }
```

然后删除文件 `editor/components/ReorderModal.tsx`：

```bash
git rm editor/components/ReorderModal.tsx
```

- [ ] **Step 5：整体替换 `editor/EditorRoot.tsx`**

```tsx file=editor/EditorRoot.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useContent, useUpdateContent } from '../components/ContentContext';
import { EditModeContext, EditModeValue, Toast } from '../components/EditMode';
import { registerLocalImage } from '../lib/localImages';
import { Session, clearSession, isExpiringSoon } from '../lib/session';
import { EditRequest, ListCollection } from '../types';
import { logout, startLogin } from './auth';
import { DeployStatus, EditorBackend, ImageUpload, createBackend, describeSaveError } from './backend';
import { GitHubError } from './github';
import { publicUrl } from './images';
import { ContentOp, applyOp, commitMessage } from './ops';
import { AdminBar, LoadState } from './components/AdminBar';
import { ItemModal } from './components/ItemModal';

const FIRST_POLL_MS = 5_000;
const POLL_MS = 10_000;
const POLL_LIMIT_MS = 10 * 60_000;
const EXPIRING = '登录即将过期，请重新登录后再编辑';

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
  const contentRef = useRef(content);
  contentRef.current = content;
  // Saves run one at a time. `pending` holds ops already shown on the page but not committed yet.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef<ContentOp[]>([]);

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
        setToast({ message: EXPIRING, relogin: true });
        return;
      }
      setRequest(next);
    },
    [session],
  );

  const save = useCallback(
    (op: ContentOp, uploads: ImageUpload[], message: string): Promise<void> => {
      if (!backend) return Promise.reject(new Error('编辑器还在加载，请稍后再试'));
      pending.current.push(op);
      const run = queue.current.then(async () => {
        try {
          const result = await backend.save(op, uploads, message, contentRef.current);
          uploads.forEach((upload) => registerLocalImage(publicUrl(upload.path), upload.previewUrl));
          pending.current = pending.current.filter((queued) => queued !== op);
          // Every op is idempotent, so re-applying the still-queued ones keeps the page as the owner left it.
          setContent(pending.current.reduce((current, queued) => applyOp(current, queued), result.content));
          setDeploy({ sha: result.commitSha, status: { state: 'pending' } });
        } catch (error) {
          pending.current = pending.current.filter((queued) => queued !== op);
          throw error;
        }
      });
      queue.current = run.catch(() => undefined);
      return run;
    },
    [backend, setContent],
  );

  const reorder = useCallback(
    (collection: ListCollection, ids: string[]) => {
      if (isExpiringSoon(session)) {
        setToast({ message: EXPIRING, relogin: true });
        return;
      }
      const op: ContentOp = { kind: 'reorder', collection, ids };
      setContent((current) => applyOp(current, op));
      save(op, [], commitMessage('reorder', collection)).catch((error: unknown) => {
        setToast({ message: describeSaveError(error) });
        // Put the page back in step with GitHub.
        backend
          ?.load()
          .then(setContent)
          .catch(() => undefined);
      });
    },
    [session, setContent, save, backend],
  );

  const handleLogout = useCallback(() => {
    void logout(session).finally(() => logoutRef.current());
  }, [session]);

  const closeDialog = useCallback(() => setRequest(null), []);

  const value = useMemo<EditModeValue>(
    () => ({
      editing: enabled && loadState === 'ready',
      loggedIn: true,
      canLogin: true,
      ready: loadState !== 'loading',
      open,
      login: relogin,
      reorder,
    }),
    [enabled, loadState, open, relogin, reorder],
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
      {request && <ItemModal request={request} content={content} onSave={save} onClose={closeDialog} />}
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

- [ ] **Step 6：各页面列表改用 `SortableGroup`**

用下面的脚本做精确替换。每段原文必须恰好出现一次，否则报错退出。各页面的条目内容不变，只是改由 `renderItem` 渲染；论文的组内排序改为只按年份（稳定排序）。

```bash
SCRATCH=/private/tmp/claude-501/-Users-zhaozihan-Projects-zihanzhao1022-github-io/0e597fae-d5e6-4686-a675-504c51112145/scratchpad
cat > "$SCRATCH/sortable-views.mjs" <<'EOF'
import { readFileSync, writeFileSync } from 'node:fs';

const IMPORT = "import { SortableGroup } from '../components/SortableGroup';";
const EDITS = {
  'views/About.tsx': [
    [
      "import { AddButton, EditButton, HiddenBadge, ReorderButton, useVisibleItems } from '../components/EditMode';",
      `import { AddButton, EditButton, HiddenBadge, useVisibleItems } from '../components/EditMode';\n${IMPORT}`,
    ],
    ["          <ReorderButton request={{ kind: 'reorder', collection: 'news' }} className=\"ml-2\" />\n", ''],
    [
      '        <div className="space-y-4">\n          {news.map((item) => (\n',
      '        <SortableGroup\n          collection="news"\n          items={news}\n          className="space-y-4"\n          renderItem={(item) => (\n',
    ],
    ['          ))}\n        </div>\n      </div>\n    </div>\n  );', '          )}\n        />\n      </div>\n    </div>\n  );'],
  ],
  'views/Experiences.tsx': [
    [
      "import { AddButton, ReorderButton, useVisibleItems } from '../components/EditMode';",
      `import { AddButton, useVisibleItems } from '../components/EditMode';\n${IMPORT}`,
    ],
    [
      "              <ReorderButton request={{ kind: 'reorder', collection: 'experiences', category: section.id }} className=\"ml-2\" />\n",
      '',
    ],
    [
      '              <div className="space-y-4">\n                {items.map((exp) => (\n',
      '              <SortableGroup\n                collection="experiences"\n                items={items}\n                className="space-y-4"\n                renderItem={(exp) => (\n',
    ],
    ['                  />\n                ))}\n              </div>\n', '                  />\n                )}\n              />\n'],
  ],
  'views/Publications.tsx': [
    [
      "import { AddButton, useVisibleItems } from '../components/EditMode';",
      `import { AddButton, useVisibleItems } from '../components/EditMode';\n${IMPORT}`,
    ],
    [
      "// Define Rank Priority\nconst RANK_PRIORITY: Record<Rank, number> = {\n  'Q1': 10,\n  'Q2': 9,\n  'Q3': 8,\n  'Q4': 7,\n  'CORE-A*': 10,\n  'CORE-A': 9,\n  'CORE-B': 8,\n  'CORE-C': 7,\n  'Unranked': 0\n};\n\n",
      '',
    ],
    [
      '  // Sorting Logic: Year (Desc) -> Type -> Rank (Desc)',
      '  // Filter, then sort by year (newest first); within a year the stored order applies (set by dragging).',
    ],
    [
      '    // 2. Sort\n    return filtered.sort((a, b) => {\n      // Primary: Year Descending\n      if (b.year !== a.year) return b.year - a.year;\n\n      // Secondary: Rank Score\n      const rankScoreA = RANK_PRIORITY[a.rank] || 0;\n      const rankScoreB = RANK_PRIORITY[b.rank] || 0;\n      return rankScoreB - rankScoreA; // Higher rank first\n    });\n',
      '    // 2. Sort (stable, so items of the same year keep their stored order)\n    return filtered.sort((a, b) => b.year - a.year);\n',
    ],
    [
      '                  <div className="space-y-4">\n                    {typePubs\n                      .filter((p) => p.year === year)\n                      .map((pub) => (\n',
      '                  <SortableGroup\n                    collection="publications"\n                    items={typePubs.filter((p) => p.year === year)}\n                    className="space-y-4"\n                    renderItem={(pub) => (\n',
    ],
    ['                        />\n                    ))}\n                  </div>\n', '                        />\n                    )}\n                  />\n'],
  ],
  'views/Projects.tsx': [
    [
      "import { AddButton, useVisibleItems } from '../components/EditMode';",
      `import { AddButton, useVisibleItems } from '../components/EditMode';\n${IMPORT}`,
    ],
    [
      '            <div className="space-y-4">\n              {sortedProjects\n                .filter((p) => getStartYear(p.year) === year)\n                .map((proj) => (\n',
      '            <SortableGroup\n              collection="projects"\n              items={sortedProjects.filter((p) => getStartYear(p.year) === year)}\n              className="space-y-4"\n              renderItem={(proj) => (\n',
    ],
    ['                />\n              ))}\n            </div>\n', '                />\n              )}\n            />\n'],
  ],
  'views/Awards.tsx': [
    [
      "import { AddButton, useVisibleItems } from '../components/EditMode';",
      `import { AddButton, useVisibleItems } from '../components/EditMode';\n${IMPORT}`,
    ],
    [
      '            <div className="space-y-4">\n              {sortedAwards\n                .filter((a) => a.year === year)\n                .map((award) => (\n',
      '            <SortableGroup\n              collection="awards"\n              items={sortedAwards.filter((a) => a.year === year)}\n              className="space-y-4"\n              renderItem={(award) => (\n',
    ],
    ['                  />\n                ))}\n            </div>\n', '                  />\n                )}\n            />\n'],
  ],
  'views/Talks.tsx': [
    [
      "import { AddButton, EditButton, HiddenBadge, ReorderButton, useVisibleItems } from '../components/EditMode';",
      `import { AddButton, EditButton, HiddenBadge, useVisibleItems } from '../components/EditMode';\n${IMPORT}`,
    ],
    ["          <ReorderButton request={{ kind: 'reorder', collection: 'talks' }} className=\"ml-2\" />\n", ''],
    [
      '      <div className="grid gap-6">\n        {talks.map((talk) => (\n',
      '      <SortableGroup\n        collection="talks"\n        items={talks}\n        className="grid gap-6"\n        renderItem={(talk) => (\n',
    ],
    ['        ))}\n      </div>\n    </div>\n  );', '        )}\n      />\n    </div>\n  );'],
  ],
};

for (const [file, edits] of Object.entries(EDITS)) {
  let code = readFileSync(file, 'utf8');
  for (const [from, to] of edits) {
    const count = code.split(from).length - 1;
    if (count !== 1) throw new Error(`${file}: expected 1 match, found ${count}:\n${from}`);
    code = code.replace(from, () => to);
  }
  writeFileSync(file, code);
  console.log(`updated ${file}`);
}
EOF
node "$SCRATCH/sortable-views.mjs"
grep -rn "ReorderButton\|RANK_PRIORITY" views components editor types.ts
```

Expected：
- 输出 6 行 `updated views/…`；
- 最后的 `grep` 没有输出（Task 3 Step 3 已经删除了 `ReorderButton` 组件）。

- [ ] **Step 7：把测试 fixture 的论文按当前显示顺序重排（年份降序、等级降序，稳定）**

```bash
node -e "
const RANK = { Q1: 10, Q2: 9, Q3: 8, Q4: 7, 'CORE-A*': 10, 'CORE-A': 9, 'CORE-B': 8, 'CORE-C': 7, Unranked: 0 };
const f = 'views/__fixtures__/content.json';
const fs = require('fs');
const data = JSON.parse(fs.readFileSync(f, 'utf8'));
data.publications = data.publications
  .map((pub, index) => ({ pub, index }))
  .sort((a, b) => b.pub.year - a.pub.year || (RANK[b.pub.rank] || 0) - (RANK[a.pub.rank] || 0) || a.index - b.index)
  .map(({ pub }) => pub);
fs.writeFileSync(f, JSON.stringify(data, null, 2) + '\n');
console.log(data.publications.map((p) => p.id).join(' '));
"
```

Expected：输出 `p4 p1 p2 p3 p5 p6 p7 p8 p9 p10`。

- [ ] **Step 8：测试、构建与产物检查**

Run: `npm test && npx tsc && git status --short views/__snapshots__`
Expected：
- 全部测试通过；
- `tsc` 无输出；
- 快照目录没有改动（`SortableGroup` 在非编辑状态下输出和原来一样的 HTML，论文按迁移后的数据顺序显示，结果相同）。

Run:

```bash
npm run build
ls dist/assets/
grep -l "DndDescribedBy" dist/assets/*.js
grep -c "DndDescribedBy" dist/assets/index-*.js
```

Expected：
- 有一个单独的 `SortableGroupImpl-*.js` chunk，也可能是它和编辑器共享的 chunk；
- `DndDescribedBy` 不出现在主包 `index-*.js` 里，最后一条输出 `0`。

- [ ] **Step 9：提交**

```bash
git add package.json package-lock.json editor components types.ts views
git commit -m "feat: drag items to reorder them in edit mode

Each list (or year/category group) gets a grip in edit mode; the dragged
card floats above the page and the new order is saved on drop through a
save queue. Replaces the reorder dialog. Publications keep their stored
order within a year instead of sorting by rank.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4：导航栏、路由与自定义页面

**Files:**
- Modify: `types.ts`、`editor/components/Modal.tsx`、`editor/EditorRoot.tsx`
- Create: `components/pages.ts`、`components/CustomPage.tsx`、`components/SiteRoutes.tsx`、`editor/components/NavigationModal.tsx`
- Replace: `components/Navbar.tsx`、`App.tsx`
- Test: `views/navigation.test.tsx`

**Interfaces:**
- Consumes：`NavItem`、`BUILTIN_PAGES`（Task 1）；`renderMarkdown`（Task 2）；`SortableList`、`EditModeValue.ready/reorder`（Task 3）。
- Produces：
  - `EditRequest` 增加 `{ kind: 'navigation' }`；
  - `SiteLayout`（`App.tsx` 的具名导出）；
  - `BUILTIN_ROUTES`、`pathOf(item)`。

- [ ] **Step 0：记下访客现在看到的导航栏 HTML，替换后用来比对**

```bash
SCRATCH=/private/tmp/claude-501/-Users-zhaozihan-Projects-zihanzhao1022-github-io/0e597fae-d5e6-4686-a675-504c51112145/scratchpad
cat > views/navbar.tmp.test.tsx <<'EOF'
import React from 'react';
import { writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { it } from 'vitest';
import Navbar from '../components/Navbar';

it('writes the navbar markup', () => {
  for (const [name, path] of [['home', '/'], ['publications', '/publications']]) {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={[path]}>
        <Navbar />
      </MemoryRouter>,
    );
    writeFileSync(`${process.env.OUT}${name}.html`, html);
  }
});
EOF
OUT=$SCRATCH/navbar-before- npx vitest run views/navbar.tmp.test.tsx
```

- [ ] **Step 1：编写失败的测试**

```tsx file=views/navigation.test.tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SiteLayout } from '../App';
import { ContentContext } from '../components/ContentContext';
import { EditModeContext, EditModeValue } from '../components/EditMode';
import { NavItem, SiteContent } from '../types';
import fixture from './__fixtures__/content.json';

const navigation: NavItem[] = [
  { id: 'about', type: 'builtin', page: 'about', label: 'about' },
  { id: 'publications', type: 'builtin', page: 'publications', label: 'papers' },
  { id: 'teaching', type: 'page', label: 'teaching', slug: 'teaching', title: 'Teaching', body: '## Courses\n- Algorithms' },
  { id: 'secret', type: 'page', label: 'secret', slug: 'secret', title: 'Secret page', body: 'Not for visitors', hidden: true },
  { id: 'cv', type: 'builtin', page: 'cv', label: 'cv', hidden: true },
  { id: 'scholar', type: 'link', label: 'scholar', url: 'https://scholar.google.com/x' },
];
const content: SiteContent = { ...(fixture as SiteContent), navigation };

const owner: EditModeValue = {
  editing: true,
  loggedIn: true,
  canLogin: true,
  ready: true,
  open: () => {},
  login: () => {},
  reorder: () => {},
};

const render = (path: string, mode?: EditModeValue): string => {
  const page = (
    <ContentContext.Provider value={content}>
      <MemoryRouter initialEntries={[path]}>
        <SiteLayout />
      </MemoryRouter>
    </ContentContext.Provider>
  );
  return renderToStaticMarkup(mode ? <EditModeContext.Provider value={mode}>{page}</EditModeContext.Provider> : page);
};

const navOf = (html: string): string => html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));

describe('navigation for visitors', () => {
  it('shows the visible entries in order, with their labels', () => {
    const nav = navOf(render('/'));
    const positions = ['about', 'papers', 'teaching', 'scholar'].map((label) => nav.indexOf(`>${label}<`));
    expect(positions.every((position) => position > 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(nav).not.toContain('>secret<');
    expect(nav).not.toContain('>cv<');
    expect(nav).toContain('href="/publications"');
  });

  it('opens external links in a new tab', () => {
    expect(navOf(render('/'))).toContain('href="https://scholar.google.com/x" target="_blank" rel="noreferrer"');
  });

  it('renders custom pages from their Markdown', () => {
    const html = render('/p/teaching');
    expect(html).toContain('Teaching');
    expect(html).toContain('Courses</h2>');
    expect(html).toContain('<li>Algorithms</li>');
  });

  it('does not open hidden pages', () => {
    expect(render('/p/secret')).not.toContain('Not for visitors');
    expect(render('/cv')).not.toContain('Download PDF');
  });
});

describe('navigation for the owner', () => {
  it('shows hidden entries faded, with the edit button', () => {
    const nav = navOf(render('/', owner));
    expect(nav).toContain('>secret<');
    expect(nav).toContain('opacity-50');
    expect(nav).toContain('编辑导航');
  });

  it('opens hidden pages', () => {
    expect(render('/p/secret', owner)).toContain('Not for visitors');
  });
});
```

Run: `npx vitest run views/navigation.test.tsx`
Expected：FAIL（`App.tsx` 还没有导出 `SiteLayout`；导航栏仍是写死的链接）。

- [ ] **Step 2：`types.ts` 增加导航请求**

把

```ts
  | { kind: 'profile'; section: ProfileSection };
```

替换为

```ts
  | { kind: 'profile'; section: ProfileSection }
  | { kind: 'navigation' };
```

- [ ] **Step 3：页面注册表、自定义页面与路由**

```ts file=components/pages.ts
import React from 'react';
import { BuiltinPage, NavItem } from '../types';
import About from '../views/About';
import Awards from '../views/Awards';
import CV from '../views/CV';
import Experiences from '../views/Experiences';
import Projects from '../views/Projects';
import Publications from '../views/Publications';
import Talks from '../views/Talks';

export const BUILTIN_ROUTES: Record<BuiltinPage, { path: string; component: React.ComponentType }> = {
  about: { path: '/', component: About },
  experiences: { path: '/experiences', component: Experiences },
  publications: { path: '/publications', component: Publications },
  projects: { path: '/projects', component: Projects },
  talks: { path: '/talks', component: Talks },
  awards: { path: '/awards', component: Awards },
  cv: { path: '/cv', component: CV },
};

/** Where a navigation entry points: a route inside the site, or the URL of an external link. */
export function pathOf(item: NavItem): string {
  if (item.type === 'builtin') return BUILTIN_ROUTES[item.page].path;
  if (item.type === 'page') return `/p/${item.slug}`;
  return item.url;
}
```

```tsx file=components/CustomPage.tsx
import React from 'react';
import { renderMarkdown } from '../lib/markdown';
import { NavItem } from '../types';
import { EditButton, HiddenBadge } from './EditMode';

/** A page the owner created in the navigation settings: a title and a Markdown body. */
const CustomPage: React.FC<{ item: Extract<NavItem, { type: 'page' }> }> = ({ item }) => (
  <div className="animate-fade-in pb-20">
    <div className="mb-10">
      <h1 className="text-3xl font-light text-gray-900 mb-2">
        {item.title}
        <EditButton
          request={{ kind: 'edit', collection: 'navigation', id: item.id }}
          label="编辑页面"
          className="ml-3 align-middle"
        />
        {item.hidden && <HiddenBadge />}
      </h1>
    </div>
    <div dangerouslySetInnerHTML={{ __html: renderMarkdown(item.body ?? '') }} />
  </div>
);

export default CustomPage;
```

```tsx file=components/SiteRoutes.tsx
import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import About from '../views/About';
import { useContent } from './ContentContext';
import CustomPage from './CustomPage';
import { useEditMode } from './EditMode';
import { BUILTIN_ROUTES } from './pages';

// Unknown addresses go home, but not while a signed-in owner's content (with hidden pages) is still loading.
const NotFound: React.FC = () => {
  const { ready } = useEditMode();
  return ready ? <Navigate to="/" replace /> : null;
};

/** Routes follow the navigation data; hidden pages only open for the signed-in owner. */
const SiteRoutes: React.FC = () => {
  const { navigation } = useContent();
  const { loggedIn } = useEditMode();
  return (
    <Routes>
      <Route path="/" element={<About />} />
      {navigation
        .filter((item) => loggedIn || !item.hidden)
        .map((item) => {
          if (item.type === 'page') {
            return <Route key={item.id} path={`/p/${item.slug}`} element={<CustomPage item={item} />} />;
          }
          if (item.type === 'builtin' && item.page !== 'about') {
            const { path, component: Page } = BUILTIN_ROUTES[item.page];
            return <Route key={item.id} path={path} element={<Page />} />;
          }
          return null;
        })}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default SiteRoutes;
```

- [ ] **Step 4：替换导航栏和 `App.tsx`**

```tsx file=components/Navbar.tsx
import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { ExternalLink, EyeOff, Pencil } from 'lucide-react';
import { useContent } from './ContentContext';
import { useEditMode, useVisibleItems } from './EditMode';
import { pathOf } from './pages';

const Navbar: React.FC = () => {
  const items = useVisibleItems(useContent().navigation);
  const { editing, open } = useEditMode();

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100 py-4 px-6 md:px-12 mb-8">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between">
        <Link
          to="/"
          className="text-xl font-bold text-gray-900 mb-4 md:mb-0 hover:text-purple-600 transition-colors duration-200 group"
        >
          Zihan <span className="font-light text-gray-600 group-hover:text-purple-500 transition-colors duration-200">ZHAO</span>
        </Link>

        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium">
          {items.map((item) =>
            item.type === 'link' ? (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center gap-1 hover:text-purple-600 transition-colors text-gray-500${item.hidden ? ' opacity-50' : ''}`}
              >
                {item.label}
                <ExternalLink size={12} />
                {item.hidden && <EyeOff size={12} />}
              </a>
            ) : (
              <NavLink
                key={item.id}
                to={pathOf(item)}
                className={({ isActive }) =>
                  `hover:text-purple-600 transition-colors ${isActive ? 'text-purple-600' : 'text-gray-500'}${item.hidden ? ' opacity-50' : ''}`
                }
              >
                {item.label}
                {item.hidden && <EyeOff size={12} className="inline ml-1 -mt-0.5" />}
              </NavLink>
            ),
          )}
          {editing && (
            <button
              type="button"
              onClick={() => open({ kind: 'navigation' })}
              className="inline-flex items-center gap-1 -my-1 px-2.5 py-1 rounded-full border border-purple-200 bg-white text-xs font-medium text-purple-700 hover:bg-purple-50"
            >
              <Pencil size={12} />
              编辑导航
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
```

```tsx file=App.tsx
import React from 'react';
import { HashRouter } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import SiteRoutes from './components/SiteRoutes';
import { ContentProvider } from './components/ContentContext';
import { EditModeProvider } from './components/EditMode';
import { LoginCallback } from './lib/session';

/** Everything inside the router; tests render it with a MemoryRouter. */
export const SiteLayout: React.FC = () => (
  <div className="min-h-screen flex flex-col bg-white">
    <Navbar />
    <main className="flex-grow w-full max-w-5xl mx-auto px-6 md:px-12">
      <SiteRoutes />
    </main>
    <Footer />
  </div>
);

const App: React.FC<{ loginCallback: LoginCallback | null }> = ({ loginCallback }) => (
  <ContentProvider>
    <EditModeProvider loginCallback={loginCallback}>
      <HashRouter>
        <SiteLayout />
      </HashRouter>
    </EditModeProvider>
  </ContentProvider>
);

export default App;
```

- [ ] **Step 5：运行导航测试**

Run: `npx vitest run views/navigation.test.tsx && npx tsc`
Expected：`6 passed`；`tsc` 无输出。

再比对访客导航栏：

```bash
SCRATCH=/private/tmp/claude-501/-Users-zhaozihan-Projects-zihanzhao1022-github-io/0e597fae-d5e6-4686-a675-504c51112145/scratchpad
OUT=$SCRATCH/navbar-after- npx vitest run views/navbar.tmp.test.tsx
diff $SCRATCH/navbar-before-home.html $SCRATCH/navbar-after-home.html && diff $SCRATCH/navbar-before-publications.html $SCRATCH/navbar-after-publications.html && echo SAME
rm views/navbar.tmp.test.tsx
```

Expected：输出 `SAME`。

- [ ] **Step 6：导航设置弹窗**

```tsx file=editor/components/NavigationModal.tsx
import React, { useState } from 'react';
import { Eye, EyeOff, Link2, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { BUILTIN_PAGES, BuiltinPage, NavItem, SiteContent } from '../../types';
import { describeSaveError } from '../backend';
import { SortableList } from '../dnd/SortableList';
import { ContentOp, commitMessage } from '../ops';
import { FormRequest, ItemModal, SaveHandler } from './ItemModal';
import { BUTTON_SECONDARY, Modal } from './Modal';

const TYPE_LABELS: Record<NavItem['type'], string> = { builtin: '内置页面', page: '自定义页面', link: '外部链接' };

const DELETE_CONFIRM: Record<NavItem['type'], string> = {
  builtin: '从导航中删除这个页面？页面内容会保留，之后可以在「恢复已删除」里加回来。',
  page: '删除这个自定义页面？页面正文会一起删除。',
  link: '删除这个外部链接？',
};

const ACTION = 'inline-flex items-center gap-1 text-gray-500 hover:text-gray-900 disabled:opacity-40';
const DANGER = 'inline-flex items-center gap-1 text-gray-500 hover:text-red-600 disabled:opacity-40';
const CHIP =
  'inline-flex items-center gap-1 px-3 py-1 rounded-full border border-gray-300 bg-white text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40';

const isHome = (item: NavItem): boolean => item.type === 'builtin' && item.page === 'about';

interface Props {
  content: SiteContent;
  onSave: SaveHandler;
  onReorder: (ids: string[]) => void;
  onClose: () => void;
}

/** The navigation bar's entries: drag to reorder; hide, edit and delete them; add pages and links. */
export const NavigationModal: React.FC<Props> = ({ content, onSave, onReorder, onClose }) => {
  const [form, setForm] = useState<FormRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items = content.navigation;
  const deleted = BUILTIN_PAGES.filter((page) => !items.some((item) => item.type === 'builtin' && item.page === page));

  const run = async (op: ContentOp, message: string) => {
    setBusy(true);
    setError(null);
    try {
      await onSave(op, [], message);
    } catch (saveError) {
      setError(describeSaveError(saveError));
    } finally {
      setBusy(false);
    }
  };

  const toggleHidden = (item: NavItem) =>
    run(
      { kind: 'setHidden', collection: 'navigation', id: item.id, hidden: !item.hidden },
      commitMessage(item.hidden ? 'unhide' : 'hide', 'nav item', item.label),
    );

  const remove = (item: NavItem) => {
    if (!window.confirm(DELETE_CONFIRM[item.type])) return;
    void run({ kind: 'delete', collection: 'navigation', id: item.id }, commitMessage('delete', 'nav item', item.label));
  };

  const restore = (page: BuiltinPage) =>
    run(
      { kind: 'upsert', collection: 'navigation', item: { id: page, type: 'builtin', page, label: page }, at: 'end' },
      commitMessage('add', 'nav item', page),
    );

  return (
    <>
      <Modal
        title="导航设置"
        onClose={onClose}
        footer={
          <button type="button" onClick={onClose} className={`${BUTTON_SECONDARY} ml-auto`}>
            完成
          </button>
        }
      >
        {error && (
          <div role="alert" className="mb-4 p-3 rounded-md bg-red-50 text-sm text-red-700">
            {error}
          </div>
        )}
        <p className="mb-3 text-xs text-gray-400">拖动左侧把手调整顺序。每个操作都会立即保存并发布。</p>
        <SortableList
          items={items}
          className="rounded-md border border-gray-200 divide-y divide-gray-100"
          handleClassName="absolute left-1.5 top-1/2 -translate-y-1/2"
          onReorder={onReorder}
          renderItem={(item) => (
            <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 pl-10 pr-3 bg-white${item.hidden ? ' opacity-50' : ''}`}>
              <span className="text-sm font-medium text-gray-900">{item.label}</span>
              <span className="px-1.5 py-0.5 rounded bg-gray-100 text-[10px] text-gray-500">
                {isHome(item) ? '首页' : TYPE_LABELS[item.type]}
                {item.hidden ? ' · 已隐藏' : ''}
              </span>
              <span className="ml-auto flex items-center gap-3 text-xs">
                {!isHome(item) && (
                  <button type="button" disabled={busy} onClick={() => void toggleHidden(item)} className={ACTION}>
                    {item.hidden ? <Eye size={13} /> : <EyeOff size={13} />}
                    {item.hidden ? '取消隐藏' : '隐藏'}
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setForm({ kind: 'edit', collection: 'navigation', id: item.id })}
                  className={ACTION}
                >
                  <Pencil size={13} />
                  编辑
                </button>
                {!isHome(item) && (
                  <button type="button" disabled={busy} onClick={() => remove(item)} className={DANGER}>
                    <Trash2 size={13} />
                    删除
                  </button>
                )}
              </span>
            </div>
          )}
        />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setForm({ kind: 'add', collection: 'navigation', preset: { type: 'page' } })}
            className={CHIP}
          >
            <Plus size={13} />
            新增页面
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setForm({ kind: 'add', collection: 'navigation', preset: { type: 'link' } })}
            className={CHIP}
          >
            <Link2 size={13} />
            新增外部链接
          </button>
          {deleted.length > 0 && <span className="ml-2 text-xs text-gray-400">恢复已删除：</span>}
          {deleted.map((page) => (
            <button key={page} type="button" disabled={busy} onClick={() => void restore(page)} className={CHIP}>
              <RotateCcw size={12} />
              {page}
            </button>
          ))}
        </div>
        {busy && <p className="mt-3 text-xs text-gray-400">保存中…</p>}
      </Modal>
      {form && <ItemModal request={form} content={content} onSave={onSave} onClose={() => setForm(null)} />}
    </>
  );
};
```

- [ ] **Step 7：只有最上层弹窗响应 Esc**

`editor/components/Modal.tsx`：把

```tsx
  const close = useRef(onClose);
  close.current = onClose;
```

替换为

```tsx
  const close = useRef(onClose);
  close.current = onClose;
  const panel = useRef<HTMLDivElement>(null);
```

把

```tsx
      if (event.key === 'Escape') close.current();
```

替换为

```tsx
      if (event.key !== 'Escape') return;
      // With a dialog opened over another, only the top one closes.
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs[dialogs.length - 1] === panel.current) close.current();
```

把

```tsx
      <div
        role="dialog"
```

替换为

```tsx
      <div
        ref={panel}
        role="dialog"
```

- [ ] **Step 8：EditorRoot 打开导航设置**

`editor/EditorRoot.tsx`：把

```tsx
import { ItemModal } from './components/ItemModal';
```

替换为

```tsx
import { ItemModal } from './components/ItemModal';
import { NavigationModal } from './components/NavigationModal';
```

把

```tsx
      {request && <ItemModal request={request} content={content} onSave={save} onClose={closeDialog} />}
```

替换为

```tsx
      {request?.kind === 'navigation' && (
        <NavigationModal
          content={content}
          onSave={save}
          onReorder={(ids) => reorder('navigation', ids)}
          onClose={closeDialog}
        />
      )}
      {request && request.kind !== 'navigation' && (
        <ItemModal request={request} content={content} onSave={save} onClose={closeDialog} />
      )}
```

- [ ] **Step 9：全部测试、类型检查、构建并提交**

Run: `npm test && npx tsc && npm run build && git status --short views/__snapshots__`
Expected：全部测试通过；`tsc` 无输出；构建成功；快照没有改动。

```bash
git add types.ts components App.tsx editor views/navigation.test.tsx
git commit -m "feat: edit the navigation bar and add custom pages and links

Routes and the navigation bar now come from content/navigation.json.
Hidden entries stay out of visitors' bars and routes.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5：浏览器验证、文档与上线

- [ ] **Step 1：在模拟模式下验证**（`preview_start` name: `dev-mock`，登录后操作）

1. **拖拽把手**：Publications 页 2025 年期刊组里的每条左侧都有把手。
2. **悬浮效果**：
   - 用键盘拖动：Tab 到把手，按空格拿起，按一下 ↓ 后截图。截图里被拖的卡片应该浮起（阴影、轻微倾斜），原位置是虚线占位框；
   - 再按空格放下：顺序随之改变，日志里出现 `[mock commit] content: reorder publications`，管理栏显示"已保存，正在部署…"。
3. **其他列表**：Experiences 的工作经历组、Talks、About 的新闻都能拖动；跨年份或跨分类拖不过去。
4. **导航设置**：点导航栏末尾的"编辑导航"打开弹窗。
   - 首页那一行没有隐藏和删除；
   - 隐藏 talks 后导航栏里它变成半透明并带小眼睛图标；关闭编辑模式开关后它从导航里消失；
   - 删除 talks 后，它出现在"恢复已删除"里，点击恢复，它回到导航末尾；
   - 用键盘拖动调整一项的位置，导航栏顺序同步改变。
5. **新增页面**：
   - 填名称 `teaching`、标题 `Teaching`、正文包含 `## Courses`、`- A`、`[link](https://example.com)`；
   - 保存后导航末尾出现 teaching，点击进入，看到标题、小标题、列表和链接；
   - 页面标题旁的铅笔能打开同一个表单；
   - 再新增一个页面，地址填 `teaching`，应提示"这个地址已被其他页面使用"。
6. **新增外部链接**：网址填 `scholar.google.com` 时提示必须以 http 开头；改成 `https://scholar.google.com` 后保存，导航里出现带外链图标的 scholar。
7. **叠加弹窗的 Esc**：在导航设置里打开编辑表单，按 Esc 只关闭表单，导航设置仍在。
8. **手机尺寸**：拖拽把手可见，导航设置弹窗全屏、可以滚动。
9. **错误处理**：设置 `localStorage.setItem('mock-fail', 'network')` 后拖动一次，出现失败提示，页面恢复原顺序。最后执行 `localStorage.removeItem('mock-fail')`。

- [ ] **Step 2：更新文档**

在 `docs/admin-setup.md` 中，把

```markdown
- 编辑弹窗里的"隐藏"可以让条目暂时不对访客显示，编辑模式下它会变成半透明并带"已隐藏"标签，随时可以取消隐藏。仓库是公开的，需要保密的内容请删除。
```

替换为

```markdown
- 编辑弹窗里的"隐藏"可以让条目暂时不对访客显示，编辑模式下它会变成半透明并带"已隐藏"标签，随时可以取消隐藏。仓库是公开的，需要保密的内容请删除。
- 拖动条目左侧的把手可以调整顺序（论文、项目、奖项只能在同一年内拖动，经历只能在同一分类内拖动），松手即保存。
- 导航栏末尾的"编辑导航"可以调整导航顺序、改名、隐藏、删除内置页面（数据保留，可恢复），以及新增自定义页面和外部链接。导航数据在 `content/navigation.json`。
```

在 `README.md` 中，把

```markdown
| `content/awards.json` | 奖项 |
```

替换为

```markdown
| `content/awards.json` | 奖项 |
| `content/navigation.json` | 导航栏（顺序、名称、自定义页面正文、外部链接） |
```

```bash
git add README.md docs/admin-setup.md
git commit -m "docs: explain drag reordering and navigation settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3：合并线上最新内容，并把论文按当前显示顺序存好**

```bash
git fetch origin
git merge --no-edit origin/main
node -e "
const RANK = { Q1: 10, Q2: 9, Q3: 8, Q4: 7, 'CORE-A*': 10, 'CORE-A': 9, 'CORE-B': 8, 'CORE-C': 7, Unranked: 0 };
const f = 'content/publications.json';
const fs = require('fs');
const pubs = JSON.parse(fs.readFileSync(f, 'utf8'));
const sorted = pubs
  .map((pub, index) => ({ pub, index }))
  .sort((a, b) => b.pub.year - a.pub.year || (RANK[b.pub.rank] || 0) - (RANK[a.pub.rank] || 0) || a.index - b.index)
  .map(({ pub }) => pub);
fs.writeFileSync(f, JSON.stringify(sorted, null, 2) + '\n');
console.log(sorted.map((p) => p.id).join(' '));
"
git add content/publications.json
git commit -m "content: store publications in their displayed order

Within a year publications now follow the stored order (set by dragging)
instead of being sorted by rank; this keeps the current order.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
npm test && npm run build
```

Expected：合并成功，没有冲突；测试和构建通过。

- [ ] **Step 4：上线**（用户已同意"直接做并上线"）

```bash
git checkout main && git merge --ff-only feat/inline-edit-mode && git push origin main && git checkout feat/inline-edit-mode
```

然后用 `gh run list --workflow deploy.yml --limit 1 --json databaseId,headSha,status` 找到本次运行，执行 `gh run watch <id> --exit-status`，最后确认线上资源已更新，并检查访客导航栏和以前一样。
