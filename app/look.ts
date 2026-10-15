import { Lang } from '../lib/i18n';
import { TagColor } from './organizer';

/** A tag's dot and chip in each of its colors. */
export const TAG_LOOK: Record<TagColor, { dot: string; chip: string }> = {
  red: { dot: 'bg-red-500', chip: 'bg-red-50 text-red-700' },
  orange: { dot: 'bg-orange-500', chip: 'bg-orange-50 text-orange-700' },
  yellow: { dot: 'bg-amber-400', chip: 'bg-amber-50 text-amber-800' },
  green: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700' },
  teal: { dot: 'bg-teal-500', chip: 'bg-teal-50 text-teal-700' },
  blue: { dot: 'bg-blue-500', chip: 'bg-blue-50 text-blue-700' },
  violet: { dot: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700' },
  gray: { dot: 'bg-gray-400', chip: 'bg-gray-100 text-gray-700' },
};

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "2 hours ago", in the interface's language; "just now" under a minute. */
export function ago(time: number, lang: Lang, now = Date.now()): string {
  const seconds = Math.round((time - now) / 1000);
  const format = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return format.format(0, 'second');
}
