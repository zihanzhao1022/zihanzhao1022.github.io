import { ListCollection, NavItem, Profile, ProfileSection, Rank } from '../types';
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

const LINK_HELP = '支持 [文字](链接) 和 **加粗**';
const YEAR_IN_TEXT = { regex: /\d{4}/, message: '需要包含四位数字的年份' };
const RANKS: Rank[] = ['Q1', 'Q2', 'Q3', 'Q4', 'CORE-A*', 'CORE-A', 'CORE-B', 'CORE-C', 'Unranked'];

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const isEducation = (state: FormState): boolean => state.category === 'education';

export const LIST_SCHEMAS: Record<Exclude<ListCollection, 'navigation'>, ListSchema> = {
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
