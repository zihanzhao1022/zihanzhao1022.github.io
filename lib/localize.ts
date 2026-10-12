import { SiteContent } from '../types';
import { Lang } from './i18n';

interface Translated {
  i18n?: { zh?: object; ja?: object };
}

const blank = (value: unknown): boolean => value === undefined || value === '' || (Array.isArray(value) && value.length === 0);

/** An item as shown in `lang`: the owner's Chinese or Japanese version of each field they translated, the English otherwise. */
export function localizeItem<T extends Translated>(item: T, lang: Lang): T {
  const version = lang === 'en' ? undefined : item.i18n?.[lang];
  if (!version) return item;
  const filled = Object.entries(version).filter(([, value]) => !blank(value));
  return filled.length > 0 ? { ...item, ...Object.fromEntries(filled) } : item;
}

/**
 * The site's content in `lang`, for showing; edits start from the content as stored. Publications and results
 * papers stay as written, and English is the content itself.
 */
export function localize(content: SiteContent, lang: Lang): SiteContent {
  if (lang === 'en') return content;
  const each = <T extends Translated>(items: T[]): T[] => items.map((item) => localizeItem(item, lang));
  return {
    ...content,
    profile: localizeItem(content.profile, lang),
    news: each(content.news),
    experiences: each(content.experiences),
    projects: each(content.projects),
    talks: each(content.talks),
    awards: each(content.awards),
    navigation: each(content.navigation),
  };
}
