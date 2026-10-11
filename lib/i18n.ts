import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { COMMON } from './phrases/common';

/**
 * The language of the site's own interface: Chinese, Japanese or English. Phrases are written in Chinese
 * in the code and looked up in tables (lib/phrases). The home page, the navigation and what the owner writes
 * (papers, comments, the CV) stay as written.
 */
export type Lang = 'zh' | 'ja' | 'en';

export const LANGS: { lang: Lang; label: string; name: string }[] = [
  { lang: 'zh', label: '中', name: '中文' },
  { lang: 'ja', label: '日', name: '日本語' },
  { lang: 'en', label: 'EN', name: 'English' },
];

/** Tags for dates and numbers. */
export const LOCALES: Record<Lang, string> = { zh: 'zh-CN', ja: 'ja-JP', en: 'en-US' };

const KEY = 'ui-lang';
const isLang = (value: unknown): value is Lang => value === 'zh' || value === 'ja' || value === 'en';

/** The first of zh, ja and en among language tags such as "ja-JP" or "zh-Hans-CN"; English otherwise. */
export function pickLang(tags: readonly string[]): Lang {
  for (const tag of tags) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLang(base)) return base;
  }
  return 'en';
}

/** The choice saved in this browser, else the browser's languages. */
function initialLang(): Lang {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (isLang(saved)) return saved;
  } catch {
    // No window (tests, the worker) or no storage (private windows).
  }
  if (typeof navigator === 'undefined') return 'en';
  return pickLang(navigator.languages?.length ? navigator.languages : [navigator.language ?? 'en']);
}

let lang: Lang = initialLang();
const listeners = new Set<() => void>();

export const getLang = (): Lang => lang;

/** Switches the interface and remembers the choice in this browser. */
export function setLang(next: Lang): void {
  if (next === lang) return;
  lang = next;
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    // Not remembered; the switch still works until the page reloads.
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The interface language; a component using it renders again when it changes. */
export const useLang = (): Lang => useSyncExternalStore(subscribe, getLang, getLang);

/**
 * Marks a phrase kept as data and translated where it is shown (`t(label)`), e.g. a form field's label.
 * lib/i18n.coverage.test.ts checks marked phrases like `t('…')` calls.
 */
export const N_ = (zh: string): string => zh;

/** Japanese and English for phrases written in Chinese. */
export type Phrases = Record<string, { ja: string; en: string }>;

/** A phrase in the interface language; `{name}` placeholders take `values`. */
export type Translate = (zh: string, values?: Record<string, string | number>) => string;

const fill = (text: string, values?: Record<string, string | number>): string =>
  values ? text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole)) : text;

/**
 * A translator for an area of the interface: `t('取消')` gives "キャンセル" or "Cancel" from `table` or the
 * common phrases, in Chinese as written otherwise. Components call `useT()` so they follow the switch; code
 * outside React calls `t` when it builds a message. lib/i18n.coverage.test.ts checks every phrase is there.
 */
export function phrases(table: Phrases): { t: Translate; useT: () => Translate; table: Phrases } {
  const t: Translate = (zh, values) => {
    if (lang === 'zh') return fill(zh, values);
    const entry = table[zh] ?? COMMON[zh];
    return fill(entry ? entry[lang] : zh, values);
  };
  const useT = (): Translate => {
    const current = useLang();
    // A new function per language, so memoized values that use it follow the switch.
    return useMemo<Translate>(() => (zh, values) => t(zh, values), [current]);
  };
  return { t, useT, table };
}

/**
 * Text to show that follows the language switch: a function that translates it when it is shown, or text
 * kept as it is. Screens keep a Message rather than the text, so what is already on screen follows the switch.
 */
export type Message = string | (() => string);

/** A message's text in the current language. */
export const say = (message: Message): string => (typeof message === 'function' ? message() : message);

/** An error whose message is translated each time it is read (when given a function), like a Message. */
export class PhraseError extends Error {
  constructor(message: Message) {
    super(say(message));
    if (typeof message === 'function') Object.defineProperty(this, 'message', { get: message, configurable: true });
  }
}

/**
 * State for a message on screen, e.g. a dialog's error: set it to a Message (a function that translates it),
 * read its text in the current language. The component renders again when the language changes.
 */
export function useMessage(): [string | null, (message: Message | null) => void] {
  useLang();
  const [message, setMessage] = useState<Message | null>(null);
  // A function given to setState is taken as an updater; wrap it to keep the function itself.
  const set = useCallback((next: Message | null) => setMessage(() => next), []);
  return [message === null ? null : say(message), set];
}

