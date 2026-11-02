import type { DiaryEntry } from './api-types';

/**
 * The entries Today last loaded, so the entry editor can open one without another request.
 * Module state is enough: the editor is only reachable from Today, which fills this first.
 */
const entries = new Map<string, DiaryEntry>();

export function rememberEntries(list: readonly DiaryEntry[]): void {
  entries.clear();
  for (const entry of list) entries.set(entry.id, entry);
}

export function rememberedEntry(id: string): DiaryEntry | undefined {
  return entries.get(id);
}
