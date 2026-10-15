import { describe, expect, it } from 'vitest';
import type { Phrases } from './i18n';

/** The interface's code, as text. */
const SOURCES = import.meta.glob<string>(
  [
    '/App.tsx',
    '/app/**/*.{ts,tsx}',
    '/components/**/*.{ts,tsx}',
    '/editor/**/*.{ts,tsx}',
    '/views/**/*.{ts,tsx}',
    '/lib/**/*.{ts,tsx}',
    '/auth-worker/src/**/*.ts',
    '!**/*.test.{ts,tsx}',
    '!**/*.d.ts',
    '!/lib/phrases/**',
  ],
  { query: '?raw', import: 'default', eager: true },
);
/** Files that show Chinese as such: the language names, dates written per language, and the made-up data of `npm run dev:mock`. */
const AS_WRITTEN = ['lib/i18n.ts', 'lib/dates.ts', 'components/LangSwitch.tsx', 'editor/mockBackend.ts', 'editor/results/mockBackend.ts'];
/** Code the worker runs too: messages it sends stay in Chinese and the site translates them, so each must be a phrase. */
const SERVER = ['auth-worker/src/', 'editor/results/collaborators.ts', 'editor/errors.ts', 'editor/github.ts'];

const CJK = /[　-〿぀-ヿ㐀-鿿＀-￯]/;
// t('…') and N_('…'), the phrase on the same line as the call.
const CALL = /\b(?:t|N_)\(\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g;
const STRING = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
const unescape = (text: string) => text.replace(/\\(.)/g, '$1');

/** A line without its comment: a `//` outside strings, a block comment, or a JSDoc line. */
function code(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('//')) return '';
  let text = line;
  let quote: string | null = null;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = null;
    } else if (char === "'" || char === '"' || char === '`') {
      quote = char;
    } else if (char === '/' && text[index + 1] === '/') {
      return text.slice(0, index);
    } else if (char === '/' && text[index + 1] === '*') {
      const end = text.indexOf('*/', index + 2);
      text = text.slice(0, index) + (end === -1 ? '' : text.slice(end + 2));
      index -= 1;
    }
  }
  return text;
}

const modules = import.meta.glob<{ table?: Phrases; COMMON?: Phrases }>('./phrases/*.ts', { eager: true });
const known = new Map<string, { ja: string; en: string }>();
for (const module of Object.values(modules)) {
  for (const table of [module.COMMON, module.table]) if (table) for (const [zh, entry] of Object.entries(table)) known.set(zh, entry);
}
const translated = (zh: string) => Boolean(known.get(zh)?.ja && known.get(zh)?.en);

const sources = Object.keys(SOURCES)
  .map((path) => path.slice(1))
  .filter((path) => !AS_WRITTEN.includes(path))
  .sort();

describe('every phrase of the interface has Japanese and English', () => {
  it.each(sources)('%s', (path) => {
    const server = SERVER.some((prefix) => path.startsWith(prefix));
    const problems: string[] = [];
    SOURCES[`/${path}`]
      .split('\n')
      .forEach((line, index) => {
        let text = code(line);
        if (!CJK.test(text)) return;
        const where = `${path}:${index + 1}`;
        for (const match of text.matchAll(CALL)) {
          if (!translated(unescape(match[2]))) problems.push(`${where} needs Japanese and English: "${unescape(match[2])}"`);
        }
        text = text.replace(CALL, '');
        if (server) {
          for (const match of text.matchAll(STRING)) {
            if (!CJK.test(match[2])) continue;
            if (match[1] === '`' && match[2].includes('${')) problems.push(`${where} a message with values cannot be translated by the site: ${match[0]}`);
            else if (!translated(unescape(match[2]))) problems.push(`${where} message the site cannot translate: "${unescape(match[2])}"`);
          }
          text = text.replace(STRING, '');
        }
        if (CJK.test(text)) problems.push(`${where} untranslated: ${line.trim()}`);
      });
    expect(problems).toEqual([]);
  });
});
