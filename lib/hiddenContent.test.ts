import { describe, expect, it } from 'vitest';
import { isContentListFile, stripHiddenItems } from './hiddenContent';

describe('stripHiddenItems', () => {
  it('drops hidden items and keeps the rest in order', () => {
    const json = JSON.stringify([{ id: 'a' }, { id: 'b', hidden: true }, { id: 'c', hidden: false }]);
    expect(JSON.parse(stripHiddenItems(json))).toEqual([{ id: 'a' }, { id: 'c', hidden: false }]);
  });
});

describe('isContentListFile', () => {
  it('matches the list files, with or without a query or Windows separators', () => {
    expect(isContentListFile('/repo/content/news.json')).toBe(true);
    expect(isContentListFile('/repo/content/publications.json?import')).toBe(true);
    expect(isContentListFile('/repo/content/navigation.json')).toBe(true);
    expect(isContentListFile('/repo/content/results.json')).toBe(true);
    expect(isContentListFile('C:\\repo\\content\\awards.json')).toBe(true);
  });

  it('leaves other JSON alone', () => {
    expect(isContentListFile('/repo/content/profile.json')).toBe(false);
    expect(isContentListFile('/repo/views/__fixtures__/content.json')).toBe(false);
    expect(isContentListFile('/repo/content/news.ts')).toBe(false);
  });
});
