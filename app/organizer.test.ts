import { describe, expect, it } from 'vitest';
import {
  Organizer,
  addFolder,
  addTag,
  emptyOrganizer,
  folderAndInside,
  inView,
  moveFolder,
  moveTo,
  paperKey,
  removeFolder,
  removeTag,
  setArchived,
  setTag,
  tidy,
  touch,
} from './organizer';

const papers = [
  { key: paperKey('me', 'a'), mine: true, title: 'Made-up adapters', venue: 'Made-up Conf' },
  { key: paperKey('me', 'b'), mine: true, title: 'Made-up survey' },
  { key: paperKey('alice', 'c'), mine: false, title: 'Made-up shared paper' },
];

function sample(): { organizer: Organizer; acl: string; sub: string; draft: string } {
  let organizer = emptyOrganizer();
  const acl = addFolder(organizer, ' ACL 2027 ', null, 1);
  organizer = acl.organizer;
  const sub = addFolder(organizer, 'Figures', acl.id, 2);
  organizer = sub.organizer;
  const draft = addTag(organizer, 'draft', 'yellow', 3);
  organizer = draft.organizer;
  organizer = moveTo(organizer, [papers[0].key], acl.id);
  organizer = moveTo(organizer, [papers[1].key], sub.id);
  organizer = setTag(organizer, [papers[0].key, papers[2].key], draft.id, true);
  return { organizer, acl: acl.id, sub: sub.id, draft: draft.id };
}

describe('folders', () => {
  it('nest, and a folder shows what is in the folders inside it', () => {
    const { organizer, acl, sub } = sample();
    expect(organizer.folders.map((folder) => folder.name)).toEqual(['ACL 2027', 'Figures']);
    expect([...folderAndInside(organizer, acl)]).toEqual([acl, sub]);
    expect(inView(organizer, papers, { kind: 'folder', id: acl }).map((paper) => paper.title)).toEqual(['Made-up adapters', 'Made-up survey']);
    expect(inView(organizer, papers, { kind: 'folder', id: sub }).map((paper) => paper.title)).toEqual(['Made-up survey']);
  });

  it('move what they hold up into their parent when removed, and never into themselves', () => {
    const { organizer, acl, sub } = sample();
    const removed = removeFolder(organizer, sub);
    expect(removed.papers[papers[1].key].folder).toBe(acl);
    expect(removeFolder(removed, acl).papers[papers[1].key]).toBeUndefined();
    expect(moveFolder(organizer, acl, sub)).toBe(organizer);
    expect(moveFolder(organizer, sub, null).folders.find((folder) => folder.id === sub)?.parent).toBeNull();
  });
});

describe('tags', () => {
  it('go on and off papers, filter the list, and leave the papers when removed', () => {
    const { organizer, draft } = sample();
    expect(inView(organizer, papers, { kind: 'tag', id: draft }).map((paper) => paper.title)).toEqual(['Made-up adapters', 'Made-up shared paper']);
    const off = setTag(organizer, [papers[2].key], draft, false);
    expect(off.papers[papers[2].key]).toBeUndefined();
    expect(removeTag(organizer, draft).papers[papers[0].key].tags).toBeUndefined();
  });
});

describe('inView', () => {
  it('splits own and shared papers, keeps archived ones apart, and searches title and venue', () => {
    let { organizer } = sample();
    organizer = setArchived(organizer, [papers[1].key], true);
    expect(inView(organizer, papers, { kind: 'mine' }).map((paper) => paper.title)).toEqual(['Made-up adapters']);
    expect(inView(organizer, papers, { kind: 'shared' }).map((paper) => paper.title)).toEqual(['Made-up shared paper']);
    expect(inView(organizer, papers, { kind: 'archived' }).map((paper) => paper.title)).toEqual(['Made-up survey']);
    expect(inView(organizer, papers, { kind: 'all' }, 'made-up conf').map((paper) => paper.title)).toEqual(['Made-up adapters']);
  });
});

describe('tidy', () => {
  it('forgets folders and tags that are gone, keeping when papers were changed', () => {
    let organizer = touch(emptyOrganizer(), papers[0].key, 5);
    organizer = { ...organizer, papers: { ...organizer.papers, [papers[0].key]: { touched: 5, folder: 'dir-gone', tags: ['tag-gone'] } } };
    expect(tidy(organizer).papers[papers[0].key]).toEqual({ touched: 5 });
  });
});
