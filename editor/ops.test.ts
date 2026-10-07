import { describe, expect, it } from 'vitest';
import { applyListOp, applyOp, commitMessage } from './ops';
import { SiteContent } from '../types';
import fixture from '../views/__fixtures__/content.json';

const content = fixture as SiteContent;

const list = [
  { id: 'a', category: 'work' },
  { id: 'b', category: 'education' },
  { id: 'c', category: 'work' },
  { id: 'd', category: 'work' },
];
const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe('applyListOp', () => {
  it('replaces an existing item in place', () => {
    const next = applyListOp(list, { kind: 'upsert', collection: 'experiences', item: { id: 'c', category: 'volunteer' } });
    expect(next.map((item) => `${item.id}:${item.category}`)).toEqual(['a:work', 'b:education', 'c:volunteer', 'd:work']);
  });

  it('puts new items first', () => {
    expect(ids(applyListOp(list, { kind: 'upsert', collection: 'experiences', item: { id: 'new' } }))).toEqual([
      'new',
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('deletes by id', () => {
    expect(ids(applyListOp(list, { kind: 'delete', collection: 'experiences', id: 'c' }))).toEqual(['a', 'b', 'd']);
  });

  it('reorders only the listed items and leaves the others in place', () => {
    expect(ids(applyListOp(list, { kind: 'reorder', collection: 'experiences', ids: ['d', 'a', 'c'] }))).toEqual([
      'd',
      'b',
      'a',
      'c',
    ]);
  });

  it('ignores unknown and repeated ids when reordering', () => {
    expect(ids(applyListOp(list, { kind: 'reorder', collection: 'experiences', ids: ['zzz', 'c', 'c', 'a'] }))).toEqual([
      'c',
      'b',
      'a',
      'd',
    ]);
  });

  it('hides and unhides an item without touching anything else', () => {
    const hidden = applyListOp(list, { kind: 'setHidden', collection: 'experiences', id: 'b', hidden: true });
    expect(hidden).toEqual([list[0], { id: 'b', category: 'education', hidden: true }, list[2], list[3]]);
    const shown = applyListOp(hidden, { kind: 'setHidden', collection: 'experiences', id: 'b', hidden: false });
    expect(shown[1]).toEqual({ id: 'b', category: 'education' });
    expect('hidden' in shown[1]).toBe(false);
  });

  it('appends new items at the end when asked', () => {
    expect(ids(applyListOp(list, { kind: 'upsert', collection: 'navigation', item: { id: 'new' }, at: 'end' }))).toEqual([
      'a',
      'b',
      'c',
      'd',
      'new',
    ]);
  });

  it('does not change the input list', () => {
    const before = structuredClone(list);
    applyListOp(list, { kind: 'delete', collection: 'experiences', id: 'a' });
    expect(list).toEqual(before);
  });
});

describe('applyOp', () => {
  it('patches only the given profile fields', () => {
    const next = applyOp(content, { kind: 'patchProfile', collection: 'profile', fields: { title: 'Researcher' } });
    expect(next.profile.title).toBe('Researcher');
    expect(next.profile.bio).toEqual(content.profile.bio);
    expect(next.news).toBe(content.news);
  });

  it('changes one collection and leaves the others untouched', () => {
    const next = applyOp(content, { kind: 'delete', collection: 'talks', id: 't1' });
    expect(ids(next.talks)).toEqual(['t2', 't3', 't4']);
    expect(next.publications).toBe(content.publications);
  });
});

describe('commitMessage', () => {
  it('formats item, list and profile messages', () => {
    expect(commitMessage('update', 'publication', 'Federated Large Domain Model System')).toBe(
      'content: update publication "Federated Large Domain Model System"',
    );
    expect(commitMessage('reorder', 'experiences')).toBe('content: reorder experiences');
    expect(commitMessage('update', 'profile bio')).toBe('content: update profile bio');
    expect(commitMessage('hide', 'publication', 'Old paper')).toBe('content: hide publication "Old paper"');
    expect(commitMessage('unhide', 'talk', 'A talk')).toBe('content: unhide talk "A talk"');
  });

  it('flattens whitespace and shortens long labels', () => {
    expect(commitMessage('add', 'news item', 'line one\n  line two')).toBe('content: add news item "line one line two"');
    expect(commitMessage('add', 'talk', 'x'.repeat(80))).toBe(`content: add talk "${'x'.repeat(57)}..."`);
  });
});
