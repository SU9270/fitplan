/** How long a "✓" stays after an add before its "＋" works again (well past a double tap). */
export const ADDED_MS = 3000;

/**
 * Which "＋" buttons of the food library's "我的" are busy: being added, or added a moment ago
 * (these show "✓"). Kept outside React state so a second tap that lands before the screen has
 * drawn the "✓" is still refused.
 */
export interface AddLock {
  /** Start adding `key`; false when it is being added or was just added. */
  take(key: string): boolean;
  /** The add failed: its "＋" works again at once. */
  release(key: string): void;
  /** The add worked: "✓" for `ADDED_MS`, then "＋" again (a second helping is a choice, later). */
  added(key: string): void;
  /** Leaving the tab: forget everything; adds still in flight are ignored when they finish. */
  reset(): void;
}

export function createAddLock(onAddedChange: (added: ReadonlySet<string>) => void, holdMs = ADDED_MS): AddLock {
  const taken = new Set<string>();
  const added = new Set<string>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const publish = () => onAddedChange(new Set(added));

  return {
    take(key) {
      if (taken.has(key)) return false;
      taken.add(key);
      return true;
    },
    release(key) {
      taken.delete(key);
    },
    added(key) {
      // Taken before a reset: that visit is over.
      if (!taken.has(key) || added.has(key)) return;
      added.add(key);
      publish();
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key);
          added.delete(key);
          taken.delete(key);
          publish();
        }, holdMs),
      );
    },
    reset() {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      taken.clear();
      const hadAdded = added.size > 0;
      added.clear();
      if (hadAdded) publish();
    },
  };
}
