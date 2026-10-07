import { SiteContent } from '../types';
import { LIST_SCHEMAS, PROFILE_SCHEMAS, Values, getPath } from './schemas';

/** An image already used on the site, offered for reuse in image fields. */
export interface ImageChoice {
  url: string;
  /** How many image fields in the content use it. */
  uses: number;
}

/**
 * Every value of an image field in the content, with the kind of field it is in
 * (e.g. "experiences.image", "profile.avatar", "profile.socials.qrCode"):
 * the lists in LIST_SCHEMAS order first, then the profile.
 */
function imageUses(content: SiteContent): { kind: string; value: unknown }[] {
  const uses: { kind: string; value: unknown }[] = [];
  for (const [collection, schema] of Object.entries(LIST_SCHEMAS)) {
    const items = content[collection as keyof typeof LIST_SCHEMAS] as unknown as Values[];
    for (const field of schema.fields) {
      if (field.type !== 'image') continue;
      for (const item of items) uses.push({ kind: `${collection}.${field.key}`, value: getPath(item, field.key) });
    }
  }
  const profile = content.profile as unknown as Values;
  for (const schema of Object.values(PROFILE_SCHEMAS)) {
    for (const field of schema.fields) {
      if (field.type === 'image') uses.push({ kind: `profile.${field.key}`, value: getPath(profile, field.key) });
      const rows = getPath(profile, field.key);
      if (!Array.isArray(rows)) continue;
      for (const column of field.columns ?? []) {
        if (column.type !== 'image') continue;
        for (const row of rows as Values[]) uses.push({ kind: `profile.${field.key}.${column.key}`, value: row[column.key] });
      }
    }
  }
  return uses;
}

/**
 * Images already used in the content, for an image field of the given kind: images used by fields of the
 * same kind first, then the rest; within each part the most used first, ties in order of first appearance.
 */
export function existingImages(content: SiteContent, kind: string): ImageChoice[] {
  const found = new Map<string, { uses: number; sameKind: boolean; first: number }>();
  imageUses(content).forEach(({ kind: usedAs, value }, index) => {
    const url = typeof value === 'string' ? value.trim() : '';
    if (!url) return;
    const entry = found.get(url) ?? { uses: 0, sameKind: false, first: index };
    entry.uses += 1;
    entry.sameKind = entry.sameKind || usedAs === kind;
    found.set(url, entry);
  });
  return [...found.entries()]
    .sort(([, a], [, b]) => Number(b.sameKind) - Number(a.sameKind) || b.uses - a.uses || a.first - b.first)
    .map(([url, { uses }]) => ({ url, uses }));
}
