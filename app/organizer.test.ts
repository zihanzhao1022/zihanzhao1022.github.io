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
  tree,
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

describe('tree', () => {
  const order = { by: 'title' as const, up: true };
  const titles = (lines: ReturnType<typeof tree>) =>
    lines.map((line) => `${'  '.repeat(line.depth)}${line.kind === 'folder' ? `[${line.folder.name} ${line.count}]` : (line.paper as { title: string }).title}`);

  it('lists the folders of each level first, then its papers, with counts over everything inside', () => {
    const { organizer } = sample();
    const lines = tree(organizer, papers, { base: null, closed: new Set(), empty: true, order });
    expect(titles(lines)).toEqual(['[ACL 2027 2]', '  [Figures 1]', '    Made-up survey', '  Made-up adapters', 'Made-up shared paper']);
    expect(lines[2].path).toEqual([lines[0].kind === 'folder' ? lines[0].folder.id : '', lines[1].kind === 'folder' ? lines[1].folder.id : '']);
  });

  it('hides what closed folders hold, starts inside a folder, and can leave out empty folders', () => {
    const { organizer, acl, sub } = sample();
    expect(titles(tree(organizer, papers, { base: null, closed: new Set([acl]), empty: true, order }))).toEqual(['[ACL 2027 2]', 'Made-up shared paper']);
    expect(titles(tree(organizer, papers, { base: acl, closed: new Set(), empty: true, order }))).toEqual(['[Figures 1]', '  Made-up survey', 'Made-up adapters']);
    const shared = papers.filter((paper) => !paper.mine);
    expect(titles(tree(organizer, shared, { base: null, closed: new Set(), empty: false, order }))).toEqual(['Made-up shared paper']);
    const lines = tree(organizer, shared, { base: null, closed: new Set(), empty: true, order });
    expect(lines.map((line) => line.kind === 'folder' && line.folder.id === acl && line.inner)).toContain(true);
    expect(lines.find((line) => line.kind === 'folder' && line.folder.id === sub)).toMatchObject({ count: 0, inner: false });
  });

  it('orders folders by the latest change inside when the list goes by last change', () => {
    let { organizer } = sample();
    organizer = addFolder(organizer, 'Zeta', null, 9).organizer;
    const zeta = organizer.folders.find((folder) => folder.name === 'Zeta')!.id;
    organizer = moveTo(organizer, [papers[2].key], zeta);
    const dated = papers.map((paper, index) => ({ ...paper, touched: [10, 20, 30][index] }));
    const lines = tree(organizer, dated, { base: null, closed: new Set(), empty: true, order: { by: 'touched', up: false } });
    expect(lines.filter((line) => line.depth === 0).map((line) => (line.kind === 'folder' ? line.folder.name : ''))).toEqual(['Zeta', 'ACL 2027']);
    expect(lines[0]).toMatchObject({ kind: 'folder', latest: 30 });
  });
});

describe('tidy', () => {
  it('forgets folders and tags that are gone, keeping when papers were changed', () => {
    let organizer = touch(emptyOrganizer(), papers[0].key, 5);
    organizer = { ...organizer, papers: { ...organizer.papers, [papers[0].key]: { touched: 5, folder: 'dir-gone', tags: ['tag-gone'] } } };
    expect(tidy(organizer).papers[papers[0].key]).toEqual({ touched: 5 });
  });
});
