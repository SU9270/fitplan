// No imports on purpose: shared by the worker (custom foods) and the Node import script.

/** `|`-separated aliases; joined back the same way when stored. */
export const ALIAS_SEPARATOR = '|';

/** What the search matches against: lowercased names and aliases, one per line. */
export function buildSearchText(name: string, nameZh: string | null, aliases: readonly string[]): string {
  return [name, nameZh, ...aliases]
    .filter((part): part is string => part !== null && part.trim() !== '')
    .map((part) => part.trim().toLowerCase())
    .join('\n');
}
