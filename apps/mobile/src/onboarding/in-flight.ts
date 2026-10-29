/**
 * Lets one async task run at a time: a call made while the previous one is still running is
 * dropped and resolves to `null`. Guards the questionnaire submit against a double tap, which
 * would otherwise send two identical PUTs (the server dedupes them, but the second is wasted).
 * Unlike `busy` state, the flag flips synchronously, so it also catches taps in the same frame.
 */
export function createInFlightGuard() {
  let running = false;
  return async function run<T>(task: () => Promise<T>): Promise<T | null> {
    if (running) return null;
    running = true;
    try {
      return await task();
    } finally {
      running = false;
    }
  };
}
