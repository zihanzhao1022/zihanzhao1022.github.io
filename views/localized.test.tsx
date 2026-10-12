import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { ContentContext } from '../components/ContentContext';
import { setLang } from '../lib/i18n';
import { SiteContent } from '../types';
import fixture from './__fixtures__/content.json';
import About from './About';
import Awards from './Awards';

const base = fixture as SiteContent;
// Made-up translations of made-up content.
const content: SiteContent = {
  ...base,
  profile: {
    ...base.profile,
    title: 'Made-up Title',
    affiliation: 'Made-up Lab',
    i18n: { zh: { title: '虚构职位', affiliation: '虚构实验室', bio: ['虚构的简介。'] } },
  },
  news: [{ id: 'n1', date: 'Jan 20, 2025', content: 'Made-up news', i18n: { zh: { content: '虚构的新闻' } } }],
  awards: [
    {
      id: 'a1',
      title: 'Made-up Contest',
      date: '2021',
      year: 2021,
      issuer: 'Made-up Committee',
      type: 'national',
      level: 'First Prize',
      i18n: { zh: { level: '一等奖' } },
    },
  ],
};

const render = (View: React.ComponentType): string =>
  renderToStaticMarkup(
    <ContentContext.Provider value={content}>
      <View />
    </ContentContext.Provider>,
  );

afterEach(() => setLang('zh'));

describe('pages in Chinese and Japanese', () => {
  it("show the owner's translations, the page's own words and dates in the language", () => {
    const html = render(About);
    expect(html).toContain('虚构的简介。');
    expect(html).toContain('虚构的新闻');
    expect(html).toContain('2025年1月20日');
    expect(html).toContain('新闻');
    // The affiliation comes before the title, as Chinese puts it.
    expect(html.indexOf('虚构实验室')).toBeLessThan(html.indexOf('虚构职位'));
  });

  it('show the English where the owner wrote no translation', () => {
    setLang('ja');
    const html = render(About);
    expect(html).toContain('Made-up news');
    expect(html).toContain('ニュース');
    expect(html).toContain('2025年1月20日');
  });

  it('colour award levels by their English in every language', () => {
    const html = render(Awards);
    expect(html).toContain('一等奖');
    expect(html).toMatch(/bg-yellow-500[^>]*>\s*一等奖/);
  });
});
