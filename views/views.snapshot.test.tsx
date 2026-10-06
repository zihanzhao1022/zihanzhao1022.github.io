import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import About from './About';
import Awards from './Awards';
import CV from './CV';
import Experiences from './Experiences';
import Projects from './Projects';
import Publications from './Publications';
import Talks from './Talks';

const VIEWS: Record<string, React.ComponentType> = {
  About,
  Awards,
  CV,
  Experiences,
  Projects,
  Publications,
  Talks,
};

// One tag per line keeps snapshot diffs readable.
const render = (View: React.ComponentType): string =>
  renderToStaticMarkup(<View />).replace(/></g, '>\n<') + '\n';

describe('views render unchanged markup', () => {
  for (const [name, View] of Object.entries(VIEWS)) {
    it(name, async () => {
      await expect(render(View)).toMatchFileSnapshot(`./__snapshots__/${name}.html`);
    });
  }
});
