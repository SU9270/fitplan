import { getLocales } from 'expo-localization';
import { useSyncExternalStore } from 'react';
import { en } from './en';
import { zh, type MessageKey } from './zh';

export type { MessageKey } from './zh';
export type Locale = 'zh' | 'en';
export type MessageParams = Record<string, string | number>;

const dictionaries: Record<Locale, Record<MessageKey, string>> = { zh, en };

/** Any Chinese variant (zh, zh-Hans-US, zh-TW…) → 'zh'; every other language → 'en'. Only the first (preferred) tag counts. */
export function localeFromTags(tags: readonly string[]): Locale {
  return tags[0]?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function deviceLocale(): Locale {
  try {
    return localeFromTags(getLocales().map((l) => l.languageTag));
  } catch {
    return 'en';
  }
}

let current: Locale = deviceLocale();
const listeners = new Set<() => void>();

/** Translate `key` in the active locale, replacing `{name}` with `params.name`. Unknown placeholders are left as-is. */
export function t(key: MessageKey, params?: MessageParams): string {
  const text = dictionaries[current][key];
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

export function getLocale(): Locale {
  return current;
}

/** Switch language for the whole app; every component using `useLocale()` re-renders. */
export function setLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Subscribe a component to the active locale. Call it in every screen that renders text so a
 * language switch re-renders it; `t` is returned for convenience (it is the same module function).
 */
export function useLocale(): { locale: Locale; setLocale: (locale: Locale) => void; t: typeof t } {
  const locale = useSyncExternalStore(subscribe, getLocale, getLocale);
  return { locale, setLocale, t };
}
