/**
 * How an account organizes the papers it sees, its own and those shared with it, like Overleaf's tags and
 * Obsidian's folders: nested folders, each paper in at most one; colored tags, any number per paper; and
 * archived papers kept out of the way. It belongs to the account, not to the papers, so a paper shared with
 * several people sits in each one's own folders. The real service keeps it in the account's repository
 * (galley.json); the prototype keeps it in this browser.
 */

export const TAG_COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'violet', 'gray'] as const;
export type TagColor = (typeof TAG_COLORS)[number];

export interface Folder {
  id: string;
  name: string;
  /** The folder it is in; null at the top. */
  parent: string | null;
}

export interface Tag {
  id: string;
  name: string;
  color: TagColor;
}

/** Where one paper is kept, by its key (owner/paper id). */
export interface Placement {
  folder?: string;
  tags?: string[];
  archived?: boolean;
  /** When the account last changed the paper, in ms. */
  touched?: number;
}

export interface Organizer {
  folders: Folder[];
  tags: Tag[];
  papers: Record<string, Placement>;
}

export const emptyOrganizer = (): Organizer => ({ folders: [], tags: [], papers: {} });

export const paperKey = (owner: string, paperId: string): string => `${owner.toLowerCase()}/${paperId}`;

/** An id no folder or tag of the organizer has yet. */
export function freshId(prefix: string, taken: string[], now = Date.now()): string {
  let id = `${prefix}-${now.toString(36)}`;
  for (let n = 2; taken.includes(id); n += 1) id = `${prefix}-${now.toString(36)}-${n}`;
  return id;
}

function place(organizer: Organizer, keys: string[], change: (placement: Placement) => Placement): Organizer {
  const papers = { ...organizer.papers };
  for (const key of keys) {
    const next = change({ ...papers[key] });
    // Nothing left to remember: forget the paper.
    if (!next.folder && !next.tags?.length && !next.archived && next.touched === undefined) delete papers[key];
    else papers[key] = next;
  }
  return { ...organizer, papers };
}

const without = (placement: Placement, field: keyof Placement): Placement => {
  const { [field]: _gone, ...rest } = placement;
  return rest;
};

export function addFolder(organizer: Organizer, name: string, parent: string | null, now = Date.now()): { organizer: Organizer; id: string } {
  const id = freshId('dir', organizer.folders.map((folder) => folder.id), now);
  return { organizer: { ...organizer, folders: [...organizer.folders, { id, name: name.trim(), parent }] }, id };
}

export const renameFolder = (organizer: Organizer, id: string, name: string): Organizer => ({
  ...organizer,
  folders: organizer.folders.map((folder) => (folder.id === id ? { ...folder, name: name.trim() } : folder)),
});

/** Removes a folder; what was in it, folders and papers, moves up into its parent. */
export function removeFolder(organizer: Organizer, id: string): Organizer {
  const folder = organizer.folders.find((item) => item.id === id);
  if (!folder) return organizer;
  const folders = organizer.folders.filter((item) => item.id !== id).map((item) => (item.parent === id ? { ...item, parent: folder.parent } : item));
  const inside = Object.keys(organizer.papers).filter((key) => organizer.papers[key].folder === id);
  const moved = place({ ...organizer, folders }, inside, (placement) => (folder.parent ? { ...placement, folder: folder.parent } : without(placement, 'folder')));
  return moved;
}

/** The folder and every folder inside it, at any depth. */
export function folderAndInside(organizer: Organizer, id: string): Set<string> {
  const found = new Set([id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const folder of organizer.folders) {
      if (folder.parent && found.has(folder.parent) && !found.has(folder.id)) {
        found.add(folder.id);
        grew = true;
      }
    }
  }
  return found;
}

/** Moves a folder into another (null: to the top), unless that would put it inside itself. */
export function moveFolder(organizer: Organizer, id: string, parent: string | null): Organizer {
  if (parent && folderAndInside(organizer, id).has(parent)) return organizer;
  return { ...organizer, folders: organizer.folders.map((folder) => (folder.id === id ? { ...folder, parent } : folder)) };
}

/** Puts papers into a folder; null takes them out of every folder. */
export const moveTo = (organizer: Organizer, keys: string[], folder: string | null): Organizer =>
  place(organizer, keys, (placement) => (folder ? { ...placement, folder } : without(placement, 'folder')));

export function addTag(organizer: Organizer, name: string, color: TagColor, now = Date.now()): { organizer: Organizer; id: string } {
  const id = freshId('tag', organizer.tags.map((tag) => tag.id), now);
  return { organizer: { ...organizer, tags: [...organizer.tags, { id, name: name.trim(), color }] }, id };
}

export const changeTag = (organizer: Organizer, id: string, change: Partial<Omit<Tag, 'id'>>): Organizer => ({
  ...organizer,
  tags: organizer.tags.map((tag) => (tag.id === id ? { ...tag, ...change, ...(change.name ? { name: change.name.trim() } : {}) } : tag)),
});

/** Removes a tag, and takes it off every paper. */
export function removeTag(organizer: Organizer, id: string): Organizer {
  const tagged = Object.keys(organizer.papers).filter((key) => organizer.papers[key].tags?.includes(id));
  const removed = place(organizer, tagged, (placement) => {
    const tags = (placement.tags ?? []).filter((tag) => tag !== id);
    return tags.length > 0 ? { ...placement, tags } : without(placement, 'tags');
  });
  return { ...removed, tags: organizer.tags.filter((tag) => tag.id !== id) };
}

/** Puts a tag on papers, or takes it off. */
export const setTag = (organizer: Organizer, keys: string[], tag: string, on: boolean): Organizer =>
  place(organizer, keys, (placement) => {
    const others = (placement.tags ?? []).filter((item) => item !== tag);
    const tags = on ? [...others, tag] : others;
    return tags.length > 0 ? { ...placement, tags } : without(placement, 'tags');
  });

export const setArchived = (organizer: Organizer, keys: string[], archived: boolean): Organizer =>
  place(organizer, keys, (placement) => (archived ? { ...placement, archived: true } : without(placement, 'archived')));

export const touch = (organizer: Organizer, key: string, at = Date.now()): Organizer => place(organizer, [key], (placement) => ({ ...placement, touched: at }));

/** What the list shows: everything, one's own, shared, archived, a folder (with what is inside it) or a tag. */
export type View = { kind: 'all' | 'mine' | 'shared' | 'archived' } | { kind: 'folder'; id: string } | { kind: 'tag'; id: string };

export interface Listed {
  key: string;
  mine: boolean;
  title: string;
  venue?: string;
}

/** The papers a view shows, matching the search; archived papers only in the archive. */
export function inView<T extends Listed>(organizer: Organizer, papers: T[], view: View, search = ''): T[] {
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const inside = view.kind === 'folder' ? folderAndInside(organizer, view.id) : null;
  return papers.filter((paper) => {
    const placement = organizer.papers[paper.key] ?? {};
    if (view.kind === 'archived' ? !placement.archived : placement.archived) return false;
    if (view.kind === 'mine' && !paper.mine) return false;
    if (view.kind === 'shared' && paper.mine) return false;
    if (inside && !(placement.folder && inside.has(placement.folder))) return false;
    if (view.kind === 'tag' && !placement.tags?.includes(view.id)) return false;
    const text = `${paper.title} ${paper.venue ?? ''}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

/** How the list is ordered: by title (folders by name) or by the last change (folders by the latest inside). */
export interface Order {
  by: 'title' | 'touched';
  up: boolean;
}

const byName = (a: string, b: string): number => a.localeCompare(b, undefined, { numeric: true });

/** Papers in the list's order; papers never changed come last when the newest are first. */
export const paperOrder =
  (order: Order) =>
  <T extends Listed & { touched?: number }>(a: T, b: T): number => {
    const direction = order.up ? 1 : -1;
    return (order.by === 'title' ? direction * byName(a.title, b.title) : direction * ((a.touched ?? 0) - (b.touched ?? 0))) || byName(a.title, b.title);
  };

/** A line of the list shown as a tree: a folder, or a paper, at the depth of the folder it is in. */
export type Line<T> =
  | {
      kind: 'folder';
      folder: Folder;
      depth: number;
      /** The folders it is in, from the outermost one shown. */
      path: string[];
      /** Papers inside it at any depth, and the latest change to any of them. */
      count: number;
      latest?: number;
      open: boolean;
      /** Whether opening it shows anything. */
      inner: boolean;
    }
  | { kind: 'paper'; paper: T; depth: number; path: string[] };

export interface TreeOptions {
  /** The folder whose contents are listed; null for the top. */
  base: string | null;
  /** Folders whose contents are hidden. */
  closed: ReadonlySet<string>;
  /** Whether folders without any of the papers are listed (when showing everything, or a folder). */
  empty: boolean;
  order: Order;
}

/**
 * The papers in the account's folders, as the lines of a tree: at each level its folders first, then its papers,
 * both in the list's order. The papers are already chosen for the view (archived ones left out).
 */
export function tree<T extends Listed & { touched?: number }>(organizer: Organizer, papers: T[], options: TreeOptions): Line<T>[] {
  const known = new Set(organizer.folders.map((folder) => folder.id));
  const papersIn = new Map<string | null, T[]>();
  for (const paper of papers) {
    const folder = organizer.papers[paper.key]?.folder;
    const at = folder && known.has(folder) ? folder : null;
    papersIn.set(at, [...(papersIn.get(at) ?? []), paper]);
  }
  const foldersIn = new Map<string | null, Folder[]>();
  for (const folder of organizer.folders) foldersIn.set(folder.parent, [...(foldersIn.get(folder.parent) ?? []), folder]);

  const totals = new Map<string, { count: number; latest?: number }>();
  const total = (id: string): { count: number; latest?: number } => {
    const known = totals.get(id);
    if (known) return known;
    // Counted as empty while counting, so stored data with a loop cannot recurse forever.
    totals.set(id, { count: 0 });
    let count = 0;
    let latest: number | undefined;
    const add = (n: number, time?: number) => {
      count += n;
      if (time !== undefined && (latest === undefined || time > latest)) latest = time;
    };
    for (const paper of papersIn.get(id) ?? []) add(1, paper.touched);
    for (const folder of foldersIn.get(id) ?? []) {
      const inner = total(folder.id);
      add(inner.count, inner.latest);
    }
    totals.set(id, { count, latest });
    return { count, latest };
  };

  const direction = options.order.up ? 1 : -1;
  const folderOrder = (a: Folder, b: Folder): number =>
    (options.order.by === 'title' ? direction * byName(a.name, b.name) : direction * ((total(a.id).latest ?? 0) - (total(b.id).latest ?? 0))) || byName(a.name, b.name);
  const shown = (folder: Folder): boolean => options.empty || total(folder.id).count > 0;

  const lines: Line<T>[] = [];
  const visit = (parent: string | null, depth: number, path: string[]) => {
    for (const folder of [...(foldersIn.get(parent) ?? [])].filter(shown).sort(folderOrder)) {
      if (path.includes(folder.id)) continue;
      const { count, latest } = total(folder.id);
      const open = !options.closed.has(folder.id);
      const inner = (foldersIn.get(folder.id) ?? []).some(shown) || (papersIn.get(folder.id) ?? []).length > 0;
      lines.push({ kind: 'folder', folder, depth, path, count, latest, open, inner });
      if (open) visit(folder.id, depth + 1, [...path, folder.id]);
    }
    for (const paper of [...(papersIn.get(parent) ?? [])].sort(paperOrder(options.order))) lines.push({ kind: 'paper', paper, depth, path });
  };
  visit(options.base, 0, options.base ? [options.base] : []);
  return lines;
}

/** Removes folders and tags that no longer exist from papers' placements (after edits elsewhere). */
export function tidy(organizer: Organizer): Organizer {
  const folders = new Set(organizer.folders.map((folder) => folder.id));
  const tags = new Set(organizer.tags.map((tag) => tag.id));
  const keys = Object.keys(organizer.papers);
  return place(organizer, keys, (placement) => {
    let next = placement;
    if (next.folder && !folders.has(next.folder)) next = without(next, 'folder');
    if (next.tags?.some((tag) => !tags.has(tag))) {
      const kept = next.tags.filter((tag) => tags.has(tag));
      next = kept.length > 0 ? { ...next, tags: kept } : without(next, 'tags');
    }
    return next;
  });
}
