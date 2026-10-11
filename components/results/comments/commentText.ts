import { LOCALES, getLang } from '../../../lib/i18n';
import { t } from '../../../lib/phrases/site';

/** How much text on each side of a quote is kept to find it again. */
const CONTEXT = 32;

/** The quote with a little of the text before and after it. */
export function contextAround(text: string, start: number, end: number): { quote: string; prefix: string; suffix: string } {
  return { quote: text.slice(start, end), prefix: text.slice(Math.max(0, start - CONTEXT), start), suffix: text.slice(end, end + CONTEXT) };
}

/** How many characters two strings share at the end (`before`) or the start (`after`). */
const sharedEnd = (a: string, b: string) => {
  let count = 0;
  while (count < a.length && count < b.length && a[a.length - 1 - count] === b[b.length - 1 - count]) count += 1;
  return count;
};
const sharedStart = (a: string, b: string) => {
  let count = 0;
  while (count < a.length && count < b.length && a[count] === b[count]) count += 1;
  return count;
};

/**
 * Where a commented quote is in a PDF's text (see layerText), after recompiles too: the occurrence whose
 * surroundings best match the ones saved with it. Null when the text no longer contains it.
 */
export function findQuote(text: string, quote: string, prefix = '', suffix = ''): { start: number; end: number } | null {
  if (!quote) return null;
  let best: { start: number; end: number } | null = null;
  let bestScore = -1;
  for (let start = text.indexOf(quote); start !== -1; start = text.indexOf(quote, start + 1)) {
    const end = start + quote.length;
    const score = sharedEnd(text.slice(0, start), prefix) + sharedStart(text.slice(end), suffix);
    if (score > bestScore) {
      best = { start, end };
      bestScore = score;
    }
  }
  return best;
}

/**
 * Tops for comment cards beside the text: each at its anchor unless that would overlap the card above, in
 * which case it moves down. A focused card sits exactly at its anchor and the others move out of its way.
 */
export function placeCards(cards: { id: string; top: number; height: number }[], gap: number, focused?: string | null): Record<string, number> {
  const tops: Record<string, number> = {};
  const at = focused ? cards.findIndex((card) => card.id === focused) : -1;
  if (at === -1) {
    let bottom = -Infinity;
    for (const card of cards) {
      tops[card.id] = Math.max(card.top, bottom + gap);
      bottom = tops[card.id] + card.height;
    }
    return tops;
  }
  tops[cards[at].id] = cards[at].top;
  for (let index = at - 1; index >= 0; index -= 1) {
    const below = tops[cards[index + 1].id];
    tops[cards[index].id] = Math.min(cards[index].top, below - gap - cards[index].height);
  }
  for (let index = at + 1; index < cards.length; index += 1) {
    const above = cards[index - 1];
    tops[cards[index].id] = Math.max(cards[index].top, tops[above.id] + above.height + gap);
  }
  return tops;
}

/** "刚刚", "5 分钟前"… then the date, in the interface's language. */
export function timeAgo(at: number, now: number): string {
  const seconds = Math.max(0, (now - at) / 1000);
  if (seconds < 60) return t('刚刚');
  if (seconds < 3600) return t('{n} 分钟前', { n: Math.floor(seconds / 60) });
  if (seconds < 86_400) return t('{n} 小时前', { n: Math.floor(seconds / 3600) });
  if (seconds < 7 * 86_400) return t('{n} 天前', { n: Math.floor(seconds / 86_400) });
  const date = new Date(at);
  // "7月1日" in Chinese and Japanese, "Jul 1" in English; the year only when it is not this one.
  const year = date.getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric';
  return new Intl.DateTimeFormat(LOCALES[getLang()], { year, month: 'short', day: 'numeric' }).format(date);
}
