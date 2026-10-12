import { describe, expect, it } from 'vitest';
import { NewsItem, SiteContent } from '../types';
import fixture from '../views/__fixtures__/content.json';
import { localize, localizeItem } from './localize';

const news: NewsItem = { id: 'n1', date: 'Jan 20, 2025', content: 'Made-up news', i18n: { zh: { content: '编造的新闻' }, ja: { content: '' } } };

describe('localizeItem', () => {
  it("shows the owner's version for the language, the English otherwise", () => {
    expect(localizeItem(news, 'zh')).toEqual({ ...news, content: '编造的新闻' });
    expect(localizeItem(news, 'en')).toBe(news);
    // A blank version shows the English.
    expect(localizeItem(news, 'ja')).toBe(news);
  });
});

describe('localize', () => {
  const content = fixture as SiteContent;
  const translated: SiteContent = { ...content, news: [news], publications: content.publications };

  it('translates the lists the owner can translate and leaves English alone', () => {
    expect(localize(translated, 'en')).toBe(translated);
    const zh = localize(translated, 'zh');
    expect(zh.news[0].content).toBe('编造的新闻');
    expect(zh.publications).toBe(translated.publications);
    expect(zh.results).toBe(translated.results);
  });
});
