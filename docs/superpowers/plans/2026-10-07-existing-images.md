# 选择已有图片 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 编辑表单的图片字段可以直接选择网站上已经在用的图片（例如复用学校 logo），不必重新上传。

**Architecture:**
- **数据**：纯函数 `existingImages(content, kind)` 按表单定义找出内容里所有图片字段的值，去重、计数并排序。
- **界面**：`ImageInput` 增加一个可选的 `choices` 参数，有可选图片时显示"选择已有图片"按钮，点开是缩略图网格。`ItemModal` 为每个图片字段算好列表，经 `FieldControl` 传下去。
- 所有代码都在编辑器 chunk 里，访客页面不变。

**Tech Stack:** React 18 · TypeScript 5.9 · Tailwind 3.4 · Vitest 3.2

**规格：** `docs/superpowers/specs/2026-10-07-existing-images-design.md`

## Global Constraints

- **访客视角零变化**：只改编辑器代码（`editor/`），访客页面快照必须不变。
- **字段类别**：列表字段为 `<集合>.<字段>`（如 `experiences.image`），个人信息为 `profile.<字段>`（如 `profile.avatar`），表格列为 `profile.<字段>.<列>`（如 `profile.socials.qrCode`）。
- **排序**：同类在前；每部分按使用次数从多到少，次数相同的按第一次出现的先后。遍历顺序是先 `LIST_SCHEMAS` 的各列表，再 `PROFILE_SCHEMAS`。
- **界面文字**：按钮"选择已有图片" / "收起"；没有可选图片（列表为空或只有当前这一张）时不显示按钮；表格里的小图片格子不加这个按钮。
- **保存**：选择已有图片只是把字段值设为图片路径，不上传文件。
- **提交信息**：用英文，结尾带 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

---

## 文件结构

| 路径 | 职责 |
|---|---|
| `editor/existingImages.ts` | 新增：`ImageChoice` 和 `existingImages(content, kind)` |
| `editor/existingImages.test.ts` | 新增：单元测试 |
| `editor/components/fields.tsx` | `ImageInput` 支持 `choices`；`FieldControl` 增加 `imageChoices` |
| `editor/components/ItemModal.tsx` | 为图片字段算出可选图片并传给 `FieldControl` |
| `docs/admin-setup.md` | 日常使用里补一条说明 |

---

### Task 1：收集网站上已有的图片

**Files:**
- Create: `editor/existingImages.ts`
- Test: `editor/existingImages.test.ts`

**Interfaces:**
- Consumes：`LIST_SCHEMAS`、`PROFILE_SCHEMAS`、`Values`、`getPath`（`editor/schemas.ts`）；`SiteContent`（`types.ts`）。
- Produces：
  - `interface ImageChoice { url: string; uses: number }`
  - `existingImages(content: SiteContent, kind: string): ImageChoice[]`

- [ ] **Step 1：编写失败的测试**

```ts file=editor/existingImages.test.ts
import { describe, expect, it } from 'vitest';
import { SiteContent } from '../types';
import fixture from '../views/__fixtures__/content.json';
import { existingImages } from './existingImages';

// The fixture uses four logos on experiences (Hosei and SWUST three times each), an avatar and a WeChat QR code.
const content = fixture as SiteContent;
const urls = (kind: string, from: SiteContent = content): string[] => existingImages(from, kind).map((choice) => choice.url);

const LOGOS = [
  '/images/experiences/logo-hosei.png',
  '/images/experiences/logo-swust.png',
  '/images/experiences/logo-uosaka.png',
  '/images/experiences/logo-ccf.png',
];

describe('existingImages', () => {
  it('lists images of the same kind first, most used first, ties in order of appearance', () => {
    expect(urls('experiences.image')).toEqual([...LOGOS, '/images/zzh.png', '/images/wechat_qr.jpg']);
  });

  it('counts the uses of each image and leaves out empty values', () => {
    const choices = existingImages(content, 'experiences.image');
    expect(choices.slice(0, 2)).toEqual([
      { url: '/images/experiences/logo-hosei.png', uses: 3 },
      { url: '/images/experiences/logo-swust.png', uses: 3 },
    ]);
    expect(choices.map((choice) => choice.url)).not.toContain('');
  });

  it('includes the avatar and the QR codes of the contact table, first for their own fields', () => {
    expect(urls('profile.avatar')[0]).toBe('/images/zzh.png');
    expect(urls('profile.socials.qrCode')[0]).toBe('/images/wechat_qr.jpg');
  });

  it('orders everything by use count when no image of the same kind exists', () => {
    expect(urls('publications.image')).toEqual([...LOGOS, '/images/zzh.png', '/images/wechat_qr.jpg']);
  });

  it('counts hidden items and ignores surrounding spaces when de-duplicating', () => {
    const extra: SiteContent = {
      ...content,
      awards: [
        { ...content.awards[0], image: ' /images/a.png ', hidden: true },
        { ...content.awards[1], image: '/images/a.png' },
      ],
    };
    expect(existingImages(extra, 'awards.image')[0]).toEqual({ url: '/images/a.png', uses: 2 });
  });

  it('returns nothing when no image is used', () => {
    const bare: SiteContent = {
      ...content,
      profile: { ...content.profile, avatar: '', socials: [] },
      experiences: content.experiences.map((item) => ({ ...item, image: '' })),
    };
    expect(existingImages(bare, 'experiences.image')).toEqual([]);
  });
});
```

Run: `npx vitest run editor/existingImages.test.ts`
Expected：FAIL（找不到 `./existingImages`）。

- [ ] **Step 2：实现**

```ts file=editor/existingImages.ts
import { SiteContent } from '../types';
import { LIST_SCHEMAS, PROFILE_SCHEMAS, Values, getPath } from './schemas';

/** An image already used on the site, offered for reuse in image fields. */
export interface ImageChoice {
  url: string;
  /** How many image fields in the content use it. */
  uses: number;
}

/**
 * Every value of an image field in the content, with the kind of field it is in
 * (e.g. "experiences.image", "profile.avatar", "profile.socials.qrCode"):
 * the lists in LIST_SCHEMAS order first, then the profile.
 */
function imageUses(content: SiteContent): { kind: string; value: unknown }[] {
  const uses: { kind: string; value: unknown }[] = [];
  for (const [collection, schema] of Object.entries(LIST_SCHEMAS)) {
    const items = content[collection as keyof typeof LIST_SCHEMAS] as unknown as Values[];
    for (const field of schema.fields) {
      if (field.type !== 'image') continue;
      for (const item of items) uses.push({ kind: `${collection}.${field.key}`, value: getPath(item, field.key) });
    }
  }
  const profile = content.profile as unknown as Values;
  for (const schema of Object.values(PROFILE_SCHEMAS)) {
    for (const field of schema.fields) {
      if (field.type === 'image') uses.push({ kind: `profile.${field.key}`, value: getPath(profile, field.key) });
      const rows = getPath(profile, field.key);
      if (!Array.isArray(rows)) continue;
      for (const column of field.columns ?? []) {
        if (column.type !== 'image') continue;
        for (const row of rows as Values[]) uses.push({ kind: `profile.${field.key}.${column.key}`, value: row[column.key] });
      }
    }
  }
  return uses;
}

/**
 * Images already used in the content, for an image field of the given kind: images used by fields of the
 * same kind first, then the rest; within each part the most used first, ties in order of first appearance.
 */
export function existingImages(content: SiteContent, kind: string): ImageChoice[] {
  const found = new Map<string, { uses: number; sameKind: boolean; first: number }>();
  imageUses(content).forEach(({ kind: usedAs, value }, index) => {
    const url = typeof value === 'string' ? value.trim() : '';
    if (!url) return;
    const entry = found.get(url) ?? { uses: 0, sameKind: false, first: index };
    entry.uses += 1;
    entry.sameKind = entry.sameKind || usedAs === kind;
    found.set(url, entry);
  });
  return [...found.entries()]
    .sort(([, a], [, b]) => Number(b.sameKind) - Number(a.sameKind) || b.uses - a.uses || a.first - b.first)
    .map(([url, { uses }]) => ({ url, uses }));
}
```

- [ ] **Step 3：运行测试与类型检查**

Run: `npx vitest run editor/existingImages.test.ts && npx tsc`
Expected：`6 passed`；`tsc` 无输出。

- [ ] **Step 4：提交**

```bash
git add editor/existingImages.ts editor/existingImages.test.ts
git commit -m "feat: list the images already used on the site

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2：在图片字段里选择已有图片

**Files:**
- Modify: `editor/components/fields.tsx`、`editor/components/ItemModal.tsx`

**Interfaces:**
- Consumes：`ImageChoice`、`existingImages`（Task 1）。
- Produces：
  - `ImageInput` 的可选参数 `choices?: ImageChoice[]`；
  - `FieldControl` 的可选参数 `imageChoices?: ImageChoice[]`。

- [ ] **Step 1：`editor/components/fields.tsx`**

把

```tsx
import { isPendingImage, prepareImage, validateImage } from '../images';
```

替换为

```tsx
import { ImageChoice } from '../existingImages';
import { isPendingImage, prepareImage, validateImage } from '../images';
```

把整个 `ImageInput` 组件（从 `const ImageInput: React.FC<` 到它结尾的 `};`，即紧接在 `const CellInput` 之前的部分）替换为：

```tsx
const fileName = (url: string): string => url.split('/').pop() || url;

const ImageInput: React.FC<{
  value: unknown;
  onChange: (value: unknown) => void;
  compact?: boolean;
  /** Images already used on the site that can be picked instead of uploading. */
  choices?: ImageChoice[];
}> = ({ value, onChange, compact = false, choices = [] }) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const current = typeof value === 'string' ? value : '';
  const src = isPendingImage(value) ? value.previewUrl : resolveImage(current);
  // Picking the image the field already shows would change nothing.
  const canChoose = choices.some((choice) => choice.url !== current);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const problem = validateImage(file);
    setError(problem);
    if (problem) return;
    setBusy(true);
    try {
      onChange(await prepareImage(file));
      setBrowsing(false);
    } catch {
      setError('图片处理失败，请换一张试试');
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const choose = (url: string) => {
    onChange(url);
    setError(null);
    setBrowsing(false);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
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
        {canChoose && !busy && (
          <button
            type="button"
            aria-expanded={browsing}
            onClick={() => setBrowsing((open) => !open)}
            className={BUTTON_SECONDARY}
          >
            {browsing ? '收起' : '选择已有图片'}
          </button>
        )}
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
      {browsing && (
        <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2 p-2 rounded-md border border-gray-200 bg-gray-50">
          {choices.map((choice) => (
            <button
              key={choice.url}
              type="button"
              title={choice.url}
              onClick={() => choose(choice.url)}
              className={`flex flex-col items-center gap-1 min-w-0 p-1.5 rounded-md border bg-white ${
                choice.url === current ? 'border-purple-500 ring-1 ring-purple-500' : 'border-gray-200 hover:border-purple-300'
              }`}
            >
              <span className="flex items-center justify-center w-full h-12 overflow-hidden">
                <img src={resolveImage(choice.url)} alt="" className="max-w-full max-h-full object-contain" />
              </span>
              <span className="w-full truncate text-[10px] text-gray-500">{fileName(choice.url)}</span>
            </button>
          ))}
        </div>
      )}
      {!compact && <p className="mt-1 text-xs text-gray-400">PNG、JPG、WebP 或 GIF，最大 5MB；超过 1600 像素会自动缩小</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};
```

把

```tsx
export const FieldControl: React.FC<{
  field: Field;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
}> = ({ field, value, error, onChange }) => {
```

替换为

```tsx
export const FieldControl: React.FC<{
  field: Field;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
  /** For image fields: images already used on the site. */
  imageChoices?: ImageChoice[];
}> = ({ field, value, error, onChange, imageChoices }) => {
```

把

```tsx
      control = <ImageInput value={value} onChange={onChange} />;
```

替换为

```tsx
      control = <ImageInput value={value} onChange={onChange} choices={imageChoices} />;
```

- [ ] **Step 2：`editor/components/ItemModal.tsx`**

把

```tsx
import { ImageUpload, describeSaveError } from '../backend';
```

替换为

```tsx
import { ImageUpload, describeSaveError } from '../backend';
import { existingImages } from '../existingImages';
```

把

```tsx
  const itemActions = request.kind === 'edit' && !form.locked;
```

替换为

```tsx
  const itemActions = request.kind === 'edit' && !form.locked;
  // Image fields offer the images already used on the site; those used by the same kind of field come first.
  const imageKind = request.kind === 'profile' ? 'profile' : request.collection;
```

把

```tsx
          error={errors[field.key]}
          onChange={(value) => setField(field.key, value)}
        />
```

替换为

```tsx
          error={errors[field.key]}
          onChange={(value) => setField(field.key, value)}
          imageChoices={field.type === 'image' ? existingImages(content, `${imageKind}.${field.key}`) : undefined}
        />
```

- [ ] **Step 3：测试、类型检查、构建**

Run: `npm test && npx tsc && npm run build && git status --short views/__snapshots__`
Expected：全部测试通过；`tsc` 无输出；构建成功；快照没有改动。

Run: `grep -c "选择已有图片" dist/assets/index-*.js`
Expected：`0`（只在编辑器 chunk 里）。

- [ ] **Step 4：提交**

```bash
git add editor/components/fields.tsx editor/components/ItemModal.tsx
git commit -m "feat: pick an image already used on the site instead of uploading

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3：浏览器验证、文档与上线

- [ ] **Step 1：在模拟模式下验证**（`preview_start` name: `dev-mock`，登录后操作）

1. 在 Experiences 页点"添加工作经历"：
   - Logo 字段旁有"选择已有图片"，点开后第一排是 Hosei、SWUST 等学校 logo，后面是头像和二维码；
   - 点 Hosei，预览变成 Hosei 的 logo，网格收起。
2. 填好必填项后保存：
   - 日志里有 `[mock commit] content: add experience …`，上传列表为空（`Array(0)`）；
   - 新条目显示 Hosei 的 logo。
3. 打开一条已经用 Hosei logo 的经历：网格里 Hosei 带紫色边框；只有当前这一张可选的字段不显示按钮。
4. 打开头像编辑：头像排在第一。
5. 手机尺寸（375px）：按钮换行不溢出，网格 3 列。

- [ ] **Step 2：更新文档**

在 `docs/admin-setup.md` 中，把

```markdown
- 拖动条目左侧的把手可以调整顺序，松手即保存。论文、项目、奖项只能在同一年内拖动，经历只能在同一分类内拖动。
```

替换为

```markdown
- 拖动条目左侧的把手可以调整顺序，松手即保存。论文、项目、奖项只能在同一年内拖动，经历只能在同一分类内拖动。
- 图片字段旁的"选择已有图片"可以直接复用网站上已经在用的图片（比如学校 logo），不用重复上传。
```

```bash
git add docs/admin-setup.md
git commit -m "docs: mention choosing existing images

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3：合并线上最新内容并检查**

```bash
git fetch origin
git merge --no-edit origin/main
npm test && npm run build
```

Expected：合并没有冲突（线上只会有 `content:` 提交）；测试和构建通过。

- [ ] **Step 4：上线**（用户已同意"直接做并上线"）

```bash
git checkout main && git merge --ff-only feat/inline-edit-mode && git push origin main && git checkout feat/inline-edit-mode
```

然后：
1. 用 `gh run list --workflow deploy.yml --limit 1 --json databaseId,headSha,status` 找到本次运行，执行 `gh run watch <id> --exit-status`；
2. 确认线上 `index.html` 引用的主包文件名和本地构建一致；
3. 确认访客页面和上线前相同。
