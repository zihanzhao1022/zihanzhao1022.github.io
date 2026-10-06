import { ListCollection, Profile, SiteContent } from '../types';

export type ListItem = { id: string } & Record<string, unknown>;

export type ContentOp =
  | { kind: 'upsert'; collection: ListCollection; item: ListItem }
  | { kind: 'delete'; collection: ListCollection; id: string }
  | { kind: 'reorder'; collection: ListCollection; ids: string[] }
  | { kind: 'setHidden'; collection: ListCollection; id: string; hidden: boolean }
  | { kind: 'patchProfile'; collection: 'profile'; fields: Partial<Profile> };

export type ListOp = Exclude<ContentOp, { kind: 'patchProfile' }>;

/** Applies one edit to a list. New items go first; reordering only moves the listed items. */
export function applyListOp<T extends { id: string }>(list: T[], op: ListOp): T[] {
  switch (op.kind) {
    case 'upsert': {
      const item = op.item as unknown as T;
      const index = list.findIndex((entry) => entry.id === item.id);
      return index === -1 ? [item, ...list] : list.map((entry, i) => (i === index ? item : entry));
    }
    case 'delete':
      return list.filter((entry) => entry.id !== op.id);
    case 'setHidden':
      return list.map((entry) => {
        if (entry.id !== op.id) return entry;
        const next: Record<string, unknown> = { ...entry };
        if (op.hidden) next.hidden = true;
        else delete next.hidden;
        return next as unknown as T;
      });
    case 'reorder': {
      const wanted = [...new Set(op.ids)].filter((id) => list.some((entry) => entry.id === id));
      const slots = list.flatMap((entry, i) => (wanted.includes(entry.id) ? [i] : []));
      const byId = new Map(list.map((entry) => [entry.id, entry]));
      const next = [...list];
      slots.forEach((slot, k) => {
        next[slot] = byId.get(wanted[k]) as T;
      });
      return next;
    }
  }
}

export function applyOp(content: SiteContent, op: ContentOp): SiteContent {
  if (op.kind === 'patchProfile') return { ...content, profile: { ...content.profile, ...op.fields } };
  const list = content[op.collection] as unknown as { id: string }[];
  return { ...content, [op.collection]: applyListOp(list, op) } as SiteContent;
}

const NOUNS: Record<ListCollection, string> = {
  news: 'news item',
  experiences: 'experience',
  publications: 'publication',
  projects: 'project',
  talks: 'talk',
  awards: 'award',
};

export const itemNoun = (collection: ListCollection): string => NOUNS[collection];

/** e.g. content: update publication "Federated Large Domain Model System" */
export function commitMessage(
  action: 'add' | 'update' | 'delete' | 'reorder' | 'hide' | 'unhide',
  target: string,
  label?: string,
): string {
  const text = label?.replace(/\s+/g, ' ').trim();
  const short = text && text.length > 60 ? `${text.slice(0, 57)}...` : text;
  return `content: ${action} ${target}${short ? ` "${short}"` : ''}`;
}
