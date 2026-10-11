import { afterEach, describe, expect, it } from 'vitest';
import { setLang } from '../../../lib/i18n';
import { contextAround, findQuote, placeCards, timeAgo } from './commentText';

describe('findQuote', () => {
  const text = 'Baseline 0.0 0.0 Ours 0.0 0.1 Ours again';

  it('finds the quote, using the text around it when it appears more than once', () => {
    expect(findQuote(text, 'Ours')).toEqual({ start: 17, end: 21 });
    expect(findQuote(text, '0.0', 'Ours ', ' 0.1')).toEqual({ start: 22, end: 25 });
    expect(findQuote(text, '0.0', 'Baseline 0.0 ', ' Ours')).toEqual({ start: 13, end: 16 });
  });

  it('gives nothing when the text changed', () => {
    expect(findQuote(text, 'Theirs')).toBeNull();
    expect(findQuote(text, '')).toBeNull();
  });
});

describe('contextAround', () => {
  it('keeps a little text on both sides', () => {
    const text = 'a'.repeat(50) + 'QUOTE' + 'b'.repeat(50);
    expect(contextAround(text, 50, 55)).toEqual({ quote: 'QUOTE', prefix: 'a'.repeat(32), suffix: 'b'.repeat(32) });
    expect(contextAround('xQUOTEy', 1, 6)).toEqual({ quote: 'QUOTE', prefix: 'x', suffix: 'y' });
  });
});

describe('placeCards', () => {
  it('keeps cards at their anchors and pushes overlapping ones down', () => {
    const cards = [
      { id: 'a', top: 0, height: 100 },
      { id: 'b', top: 50, height: 80 },
      { id: 'c', top: 400, height: 50 },
    ];
    expect(placeCards(cards, 12)).toEqual({ a: 0, b: 112, c: 400 });
  });

  it('puts the focused card at its anchor and moves the others out of its way', () => {
    const cards = [
      { id: 'a', top: 0, height: 100 },
      { id: 'b', top: 50, height: 80 },
      { id: 'c', top: 120, height: 50 },
    ];
    expect(placeCards(cards, 10, 'b')).toEqual({ a: -60, b: 50, c: 140 });
  });
});

describe('timeAgo', () => {
  const now = Date.UTC(2026, 9, 11, 12, 0, 0);
  afterEach(() => setLang('zh'));

  it('says how long ago, then the date', () => {
    expect(timeAgo(now - 20_000, now)).toBe('刚刚');
    expect(timeAgo(now - 5 * 60_000, now)).toBe('5 分钟前');
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe('3 小时前');
    expect(timeAgo(now - 2 * 86_400_000, now)).toBe('2 天前');
    expect(timeAgo(Date.UTC(2026, 6, 1, 12), now)).toBe('7月1日');
    expect(timeAgo(Date.UTC(2025, 6, 1, 12), now)).toBe('2025年7月1日');
  });

  it('speaks the interface language', () => {
    setLang('en');
    expect(timeAgo(now - 20_000, now)).toBe('just now');
    expect(timeAgo(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(timeAgo(Date.UTC(2026, 6, 1, 12), now)).toBe('Jul 1');
    expect(timeAgo(Date.UTC(2025, 6, 1, 12), now)).toBe('Jul 1, 2025');
  });
});
