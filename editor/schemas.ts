import { N_ } from '../lib/i18n';
import { t } from '../lib/phrases/editor';
import { ListCollection, NavItem, Profile, ProfileSection, Rank } from '../types';
import { DEFAULT_PREAMBLE } from './tex/document';
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
  /** Height of textareas, overriding the default for the field type. */
  rows?: number;
}

export interface FormSchema {
  addTitle?: string;
  editTitle: string;
  fields: Field[];
  /** Identifies an item in commit messages. */
  label: (item: Values) => string;
  /** Derives stored values from edited ones, e.g. an award's year from its date. */
  finalize?: (item: Values) => Values;
  /** Starting values for a new item. */
  defaults?: () => Values;
}

export interface ListSchema extends FormSchema {
  addTitle: string;
  idPrefix: string;
  /** Keys whose value must differ from every other item in the list, with the message shown otherwise. */
  unique?: Record<string, string>;
}

// Titles, labels, help texts and messages are phrases (N_), translated where the form shows them.
const LINK_HELP = N_('支持 [文字](链接) 和 **加粗**');
const YEAR_IN_TEXT = { regex: /\d{4}/, message: N_('需要包含四位数字的年份') };
const RANKS: Rank[] = ['Q1', 'Q2', 'Q3', 'Q4', 'CORE-A*', 'CORE-A', 'CORE-B', 'CORE-C', 'Unranked'];

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const SLUG = { regex: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, message: N_('只能用小写字母、数字和连字符，例如 teaching') };
const isEducation = (state: FormState): boolean => state.category === 'education';
// One GitHub user name per line (blank lines are fine). Written so that no input makes it backtrack badly.
const GITHUB_LOGINS = {
  regex: /^[ \t]*(?:@?[A-Za-z0-9][A-Za-z0-9-]{0,38}[ \t]*)?(?:\r?\n[ \t]*(?:@?[A-Za-z0-9][A-Za-z0-9-]{0,38}[ \t]*)?)*$/,
  message: N_('每行一个 GitHub 用户名，只能包含字母、数字和连字符'),
};

/** User names without "@", each once (GitHub ignores case); undefined for an empty list. */
function logins(value: unknown): string[] | undefined {
  const names = Array.isArray(value) ? value.map((name) => String(name).trim().replace(/^@/, '')).filter(Boolean) : [];
  const unique = names.filter((name, index) => names.findIndex((other) => other.toLowerCase() === name.toLowerCase()) === index);
  return unique.length > 0 ? unique : undefined;
}

/** Sets or removes optional list fields. */
function withLists(item: Values, lists: Record<string, string[] | undefined>): Values {
  const next = { ...item };
  for (const [key, list] of Object.entries(lists)) {
    if (list) next[key] = list;
    else delete next[key];
  }
  return next;
}

export const LIST_SCHEMAS: Record<Exclude<ListCollection, 'navigation'>, ListSchema> = {
  news: {
    addTitle: N_('添加新闻'),
    editTitle: N_('编辑新闻'),
    idPrefix: 'n',
    label: (item) => text(item.content),
    fields: [
      { key: 'date', label: N_('日期'), type: 'text', required: true, placeholder: 'Oct 6, 2026' },
      { key: 'content', label: N_('内容'), type: 'markdown', required: true, help: LINK_HELP },
    ],
  },
  experiences: {
    addTitle: N_('添加经历'),
    editTitle: N_('编辑经历'),
    idPrefix: 'exp',
    label: (item) => text(item.title),
    defaults: () => ({ category: 'education' }),
    fields: [
      {
        key: 'category',
        label: N_('分类'),
        type: 'select',
        required: true,
        options: [
          { value: 'education', label: N_('教育') },
          { value: 'work', label: N_('工作') },
          { value: 'volunteer', label: N_('志愿与服务') },
        ],
      },
      { key: 'title', label: N_('学位 / 职位'), type: 'text', required: true },
      { key: 'institution', label: N_('机构'), type: 'text', required: true },
      { key: 'department', label: N_('院系'), type: 'text', showIf: isEducation },
      { key: 'location', label: N_('地点'), type: 'text', required: true, placeholder: 'Tokyo, Japan' },
      { key: 'date', label: N_('时间'), type: 'text', required: true, placeholder: 'Sep. 2023 - Present' },
      { key: 'gpa', label: 'GPA', type: 'text', showIf: isEducation, placeholder: '3.5/4.0' },
      { key: 'rank', label: N_('排名'), type: 'text', showIf: isEducation, placeholder: 'Top 5%' },
      { key: 'description', label: N_('描述'), type: 'textarea', showIf: (state) => !isEducation(state) },
      { key: 'image', label: 'Logo', type: 'image' },
    ],
  },
  publications: {
    addTitle: N_('添加论文'),
    editTitle: N_('编辑论文'),
    idPrefix: 'p',
    label: (item) => text(item.title),
    defaults: () => ({ type: 'journal', rank: 'Q1', year: new Date().getFullYear(), authors: ['**Zihan Zhao**'] }),
    fields: [
      { key: 'title', label: N_('标题'), type: 'textarea', required: true },
      {
        key: 'authors',
        label: N_('作者'),
        type: 'lines',
        required: true,
        help: N_('每行一位；用 **名字** 加粗并加下划线（本人或共同一作）'),
      },
      { key: 'year', label: N_('年份'), type: 'year', required: true },
      { key: 'venue', label: N_('期刊 / 会议'), type: 'text', required: true },
      {
        key: 'type',
        label: N_('类型'),
        type: 'select',
        required: true,
        options: [
          { value: 'journal', label: N_('期刊') },
          { value: 'conference', label: N_('会议') },
        ],
      },
      {
        key: 'rank',
        label: N_('等级'),
        type: 'select',
        required: true,
        options: RANKS.map((rank) => ({ value: rank, label: rank === 'Unranked' ? N_('其他（显示为 Else）') : rank })),
      },
      {
        key: 'impactFactor',
        label: N_('影响因子'),
        type: 'text',
        placeholder: '6.9',
        showIf: (state) => state.type === 'journal',
      },
      { key: 'image', label: N_('缩略图'), type: 'image' },
      { key: 'links.abs', label: N_('Abstract 链接'), type: 'text', placeholder: 'https://' },
      { key: 'links.pdf', label: N_('PDF 链接'), type: 'text', placeholder: 'https://' },
      { key: 'links.doi', label: N_('DOI 链接'), type: 'text', placeholder: 'https://doi.org/…' },
      { key: 'links.code', label: N_('代码链接'), type: 'text', placeholder: 'https://github.com/…' },
    ],
  },
  projects: {
    addTitle: N_('添加项目'),
    editTitle: N_('编辑项目'),
    idPrefix: 'prj',
    label: (item) => text(item.title),
    fields: [
      { key: 'title', label: N_('项目名称'), type: 'textarea', required: true },
      { key: 'role', label: N_('角色'), type: 'text', required: true, placeholder: 'Project Leader' },
      { key: 'description', label: N_('简介'), type: 'textarea', required: true },
      {
        key: 'year',
        label: N_('时间'),
        type: 'text',
        required: true,
        placeholder: 'Mar. 2023 - May 2023',
        pattern: YEAR_IN_TEXT,
        help: N_('按其中第一个年份分组排序'),
      },
      { key: 'level', label: N_('级别'), type: 'text', required: true, placeholder: 'National Key R&D Program' },
      { key: 'image', label: N_('图片'), type: 'image' },
    ],
  },
  talks: {
    addTitle: N_('添加报告'),
    editTitle: N_('编辑报告'),
    idPrefix: 't',
    label: (item) => text(item.title),
    fields: [
      { key: 'title', label: N_('题目'), type: 'textarea', required: true },
      { key: 'event', label: N_('活动名称'), type: 'text', placeholder: 'AI Seminar Series' },
      { key: 'date', label: N_('日期'), type: 'text', required: true, placeholder: 'Dec 2024' },
      { key: 'host', label: N_('主办方'), type: 'text', required: true },
      { key: 'location', label: N_('地点'), type: 'text', required: true },
      { key: 'collaborators', label: N_('合作方'), type: 'text' },
    ],
  },
  awards: {
    addTitle: N_('添加奖项'),
    editTitle: N_('编辑奖项'),
    idPrefix: 'aw',
    label: (item) => text(item.title),
    defaults: () => ({ type: 'international' }),
    finalize: (item) => ({ ...item, year: Number(text(item.date).match(/\d{4}/)?.[0] ?? item.year) }),
    fields: [
      { key: 'title', label: N_('奖项名称'), type: 'textarea', required: true },
      { key: 'issuer', label: N_('颁发机构'), type: 'text', required: true },
      {
        key: 'date',
        label: N_('日期'),
        type: 'text',
        required: true,
        placeholder: 'Sep 2025',
        pattern: YEAR_IN_TEXT,
        help: N_('按其中的年份分组'),
      },
      {
        key: 'type',
        label: N_('类型'),
        type: 'select',
        required: true,
        options: [
          { value: 'international', label: N_('国际') },
          { value: 'national', label: N_('国家级（中国）') },
          { value: 'provincial', label: N_('省级（中国）') },
          { value: 'scholarship', label: N_('奖学金') },
        ],
      },
      {
        key: 'level',
        label: N_('等级'),
        type: 'text',
        placeholder: 'First Prize',
        help: N_('含 Gold / First、Silver / Second、Bronze / Third 时自动配色'),
      },
      { key: 'prize', label: N_('奖金'), type: 'text', placeholder: 'JPY 200,000' },
      { key: 'image', label: N_('图片'), type: 'image' },
    ],
  },
  results: {
    addTitle: N_('添加论文'),
    editTitle: N_('编辑论文信息'),
    idPrefix: 'res',
    label: (item) => text(item.title),
    // New papers stay private until the owner unhides (publishes) them.
    defaults: () => ({
      hidden: true,
      authors: ['**Zihan Zhao**'],
      year: new Date().getFullYear(),
      preamble: DEFAULT_PREAMBLE,
      files: [],
      blocks: [],
    }),
    unique: { slug: N_('这个地址已被其他论文使用') },
    finalize: (item) =>
      withLists(
        {
          ...item,
          slug: text(item.slug) || slugify(text(item.title)).slice(0, 60).replace(/-+$/, '') || String(item.id),
          authors: Array.isArray(item.authors) ? item.authors : [],
        },
        { viewers: logins(item.viewers), editors: logins(item.editors) },
      ),
    fields: [
      { key: 'title', label: N_('标题'), type: 'textarea', required: true },
      { key: 'slug', label: N_('页面地址'), type: 'text', pattern: SLUG, help: N_('网址为 #/results/<地址>；留空则根据标题生成') },
      { key: 'authors', label: N_('作者'), type: 'lines', help: N_('每行一位；用 **名字** 加粗（本人或共同一作）') },
      { key: 'venue', label: N_('会议 / 状态'), type: 'text', placeholder: 'ICLR 2027 · under review' },
      { key: 'year', label: N_('年份'), type: 'year' },
      { key: 'summary', label: N_('简介'), type: 'textarea', help: N_('显示在目录页的卡片上') },
      {
        key: 'viewers',
        label: N_('可以查看的人'),
        type: 'lines',
        pattern: GITHUB_LOGINS,
        rows: 3,
        help: N_('每行一个 GitHub 用户名。论文隐藏时他们用 GitHub 登录后也能看到，但只看到可见块的结果，看不到 LaTeX 代码'),
      },
    ],
  },
};

const PLATFORMS: Option[] = [
  { value: 'email', label: 'Email' },
  { value: 'github', label: 'GitHub' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'orcid', label: 'ORCID' },
  { value: 'wechat', label: N_('微信') },
  { value: 'overwatch', label: N_('守望先锋') },
];

export const PROFILE_SCHEMAS: Record<ProfileSection, FormSchema> = {
  basics: {
    editTitle: N_('编辑基本信息'),
    label: () => 'basics',
    fields: [
      { key: 'name.first', label: N_('名（First name）'), type: 'text', required: true },
      { key: 'name.last', label: N_('姓（Last name）'), type: 'text', required: true },
      { key: 'name.chinese', label: N_('中文名'), type: 'text' },
      { key: 'title', label: N_('职位'), type: 'text', required: true, placeholder: 'PhD Candidate' },
      { key: 'affiliation', label: N_('单位'), type: 'text', required: true },
      { key: 'email', label: N_('邮箱'), type: 'text', required: true },
      {
        key: 'languages',
        label: N_('语言'),
        type: 'rows',
        addLabel: N_('添加语言'),
        columns: [
          { key: 'language', label: N_('语言'), type: 'text', required: true },
          { key: 'proficiency', label: N_('水平'), type: 'text', required: true },
        ],
      },
    ],
  },
  bio: {
    editTitle: N_('编辑简介'),
    label: () => 'bio',
    fields: [{ key: 'bio', label: N_('简介'), type: 'paragraphs', required: true, help: N_('段落之间空一行；支持 [文字](链接) 和 **加粗**') }],
  },
  avatar: {
    editTitle: N_('更换头像'),
    label: () => 'avatar',
    fields: [{ key: 'avatar', label: N_('头像'), type: 'image', required: true }],
  },
  socials: {
    editTitle: N_('编辑联系方式'),
    label: () => 'socials',
    fields: [
      {
        key: 'socials',
        label: N_('联系方式'),
        type: 'rows',
        addLabel: N_('添加联系方式'),
        help: N_('微信的链接可以填 #，并上传二维码；访客点图标时会显示二维码。守望先锋的链接填 #，点图标会在简介第二段下面显示段位'),
        columns: [
          { key: 'platform', label: N_('平台'), type: 'select', options: PLATFORMS, required: true },
          { key: 'url', label: N_('链接'), type: 'text', required: true, placeholder: 'https://' },
          { key: 'qrCode', label: N_('二维码'), type: 'image' },
        ],
      },
    ],
  },
};

export function visibleFields(schema: FormSchema, state: FormState): Field[] {
  return schema.fields.filter((field) => !field.showIf || field.showIf(state));
}

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const WEB_ADDRESS = { regex: /^https?:\/\/\S+$/i, message: N_('请填写以 http:// 或 https:// 开头的网址') };
const BODY_HELP =
  N_('支持 ## 小标题、- 列表、1. 编号列表、[文字](链接)、**加粗**；单独一行的 ![说明](图片地址) 会显示图片；空行分段');

export const NAV_SCHEMAS: Record<NavItem['type'], ListSchema> = {
  builtin: {
    addTitle: N_('恢复页面'),
    editTitle: N_('编辑导航项'),
    idPrefix: 'nav',
    label: (item) => text(item.label),
    fields: [{ key: 'label', label: N_('导航名称'), type: 'text', required: true }],
  },
  page: {
    addTitle: N_('新增页面'),
    editTitle: N_('编辑页面'),
    idPrefix: 'page',
    label: (item) => text(item.label),
    defaults: () => ({ type: 'page', body: '' }),
    unique: { slug: N_('这个地址已被其他页面使用') },
    finalize: (item) => ({
      ...item,
      slug: text(item.slug) || slugify(text(item.label)) || String(item.id),
      body: text(item.body),
    }),
    fields: [
      { key: 'label', label: N_('导航名称'), type: 'text', required: true, placeholder: 'teaching' },
      { key: 'title', label: N_('页面标题'), type: 'text', required: true, placeholder: 'teaching' },
      { key: 'slug', label: N_('页面地址'), type: 'text', pattern: SLUG, help: N_('网址为 #/p/<地址>；留空则根据导航名称生成') },
      { key: 'body', label: N_('正文'), type: 'markdown', rows: 14, help: BODY_HELP },
    ],
  },
  link: {
    addTitle: N_('新增外部链接'),
    editTitle: N_('编辑外部链接'),
    idPrefix: 'link',
    label: (item) => text(item.label),
    defaults: () => ({ type: 'link' }),
    fields: [
      { key: 'label', label: N_('导航名称'), type: 'text', required: true, placeholder: 'scholar' },
      {
        key: 'url',
        label: N_('网址'),
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
  const label = t(field.label);
  if (field.type === 'image') return t('请上传{label}', { label });
  if (field.type === 'select') return t('请选择{label}', { label });
  return t('请填写{label}', { label });
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
      errors[field.key] = t('请填写四位数字的年份');
    } else if (field.pattern && !field.pattern.regex.test(text(value))) {
      errors[field.key] = t(field.pattern.message);
    } else if (field.type === 'rows') {
      const missing = (value as Values[]).flatMap((row, index) =>
        (field.columns ?? [])
          .filter((column) => column.required && isBlankCell(column, row[column.key]))
          .map((column) => ({ row: index + 1, label: t(column.label) })),
      );
      if (missing.length > 0) errors[field.key] = t('请填写第 {row} 行的{label}', missing[0]);
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
