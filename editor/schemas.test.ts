import { describe, expect, it } from 'vitest';
import { PendingImage } from './images';
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
    const item = newItem(LIST_SCHEMAS.publications);
    expect(item.id).toMatch(/^p-[0-9a-z]+$/);
    expect(item).toMatchObject({ type: 'journal', rank: 'Q1', authors: ['**Zihan Zhao**'] });
  });
});

describe('results paper form', () => {
  const schema = LIST_SCHEMAS.results;
  const paper = { id: 'res-a', slug: 'a', title: 'A', authors: ['**Zihan Zhao**'], hidden: true, blocks: [] };

  it('keeps one GitHub user name per line, without "@" or repeats', () => {
    const state = { ...toFormState(schema, paper), viewers: ' @Alice \n\nbob\nalice\n', editors: 'carol-1' };
    expect(validateForm(schema, state)).toEqual({});
    const { item } = fromFormState(schema, state, paper, now);
    expect(item.viewers).toEqual(['Alice', 'bob']);
    expect(item.editors).toEqual(['carol-1']);
  });

  it('removes a list that was emptied', () => {
    const shared = { ...paper, viewers: ['alice'], editors: ['bob'] };
    const { item } = fromFormState(schema, { ...toFormState(schema, shared), viewers: ' \n', editors: 'bob' }, shared, now);
    expect(item).not.toHaveProperty('viewers');
    expect(item.editors).toEqual(['bob']);
  });

  it('rejects anything that is not a user name', () => {
    for (const viewers of ['alice bob', 'a/b', 'https://github.com/alice', `${'a'.repeat(40)}`]) {
      expect(validateForm(schema, { ...toFormState(schema, paper), viewers })).toHaveProperty('viewers');
    }
    // Long blank-padded input fails fast instead of backtracking.
    const started = Date.now();
    validateForm(schema, { ...toFormState(schema, paper), viewers: `${' \n'.repeat(5000)}  a  b` });
    expect(Date.now() - started).toBeLessThan(500);
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
