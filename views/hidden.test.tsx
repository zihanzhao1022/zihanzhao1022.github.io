import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ContentContext } from '../components/ContentContext';
import { EditModeContext, EditModeValue } from '../components/EditMode';
import { SiteContent } from '../types';
import fixture from './__fixtures__/content.json';
import About from './About';
import Awards from './Awards';
import CV from './CV';
import Experiences from './Experiences';
import Projects from './Projects';
import Publications from './Publications';
import Talks from './Talks';

const base = fixture as SiteContent;
const hideFirst = <T extends { hidden?: boolean }>(items: T[]): T[] =>
  items.map((item, index) => (index === 0 ? { ...item, hidden: true } : item));

// The first item of every list is hidden.
const content: SiteContent = {
  ...base,
  news: hideFirst(base.news),
  experiences: hideFirst(base.experiences),
  publications: hideFirst(base.publications),
  projects: hideFirst(base.projects),
  talks: hideFirst(base.talks),
  awards: hideFirst(base.awards),
};

const editing: EditModeValue = { editing: true, loggedIn: true, canLogin: true, open: () => {}, login: () => {} };

const render = (View: React.ComponentType, mode?: EditModeValue): string =>
  renderToStaticMarkup(
    <ContentContext.Provider value={content}>
      {mode ? (
        <EditModeContext.Provider value={mode}>
          <View />
        </EditModeContext.Provider>
      ) : (
        <View />
      )}
    </ContentContext.Provider>,
  );

const CASES: { name: string; View: React.ComponentType; hiddenText: string }[] = [
  { name: 'About', View: About, hiddenText: base.news[0].content },
  { name: 'Experiences', View: Experiences, hiddenText: base.experiences[0].title },
  { name: 'Publications', View: Publications, hiddenText: base.publications[0].title },
  { name: 'Projects', View: Projects, hiddenText: base.projects[0].title },
  { name: 'Talks', View: Talks, hiddenText: base.talks[0].title },
  { name: 'Awards', View: Awards, hiddenText: base.awards[0].title },
];

describe('hidden items', () => {
  for (const { name, View, hiddenText } of CASES) {
    it(`${name} leaves hidden items out for visitors`, () => {
      const html = render(View);
      expect(html).not.toContain(hiddenText);
      expect(html).not.toContain('已隐藏');
    });

    it(`${name} shows hidden items, marked, while editing`, () => {
      const html = render(View, editing);
      expect(html).toContain(hiddenText);
      expect(html).toContain('已隐藏');
      expect(html).toContain('opacity-50');
    });
  }

  it('keeps hidden items off the CV, even while editing', () => {
    for (const mode of [undefined, editing]) {
      const html = render(CV, mode);
      expect(html).not.toContain(base.publications[0].title);
      expect(html).not.toContain(base.projects[0].title);
      expect(html).not.toContain(base.talks[0].title);
    }
  });
});
