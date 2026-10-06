import { describe, expect, it } from 'vitest';
import { bundledContent } from './index';

describe('bundled content', () => {
  it('gives every list item a unique id', () => {
    const { news, experiences, publications, projects, talks, awards } = bundledContent;
    const lists: { id: string }[][] = [news, experiences, publications, projects, talks, awards];
    for (const list of lists) {
      const ids = list.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
