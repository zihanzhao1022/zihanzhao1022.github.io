import { Lang } from './i18n';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const NOW: Record<Exclude<Lang, 'en'>, string> = { zh: '至今', ja: '現在' };
const RANGE: Record<Exclude<Lang, 'en'>, string> = { zh: ' – ', ja: '～' };

/** 1–12 for an English month name or its abbreviation ("Sep", "Sept", "July"); 0 otherwise. */
const month = (word: string): number => {
  const lower = word.toLowerCase();
  return lower.length >= 3 ? MONTHS.findIndex((name) => name.startsWith(lower)) + 1 : 0;
};

/** "May 27, 2026", "Sep. 2023", "2023" or "Present" in Chinese or Japanese; null for anything else. */
function part(text: string, lang: Exclude<Lang, 'en'>): string | null {
  if (/^(present|now)$/i.test(text)) return NOW[lang];
  if (/^\d{4}$/.test(text)) return `${text}年`;
  const dated = /^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(text);
  if (dated && month(dated[1])) return `${dated[3]}年${month(dated[1])}月${Number(dated[2])}日`;
  const monthly = /^([A-Za-z]+)\.?,?\s+(\d{4})$/.exec(text);
  if (monthly && month(monthly[1])) return `${monthly[2]}年${month(monthly[1])}月`;
  return null;
}

/**
 * A date the owner wrote in English, in the site's language: "Sep. 2023 - Present" becomes "2023年9月 – 至今"
 * in Chinese. Text it cannot read, and everything in English, stays as written.
 */
export function localDate(text: string, lang: Lang): string {
  if (lang === 'en') return text;
  const parts = text.trim().split(/\s*[-–—~～]\s*/);
  if (parts.length > 2) return text;
  const done = parts.map((piece) => part(piece, lang));
  return done.every((piece): piece is string => piece !== null) ? done.join(RANGE[lang]) : text;
}
