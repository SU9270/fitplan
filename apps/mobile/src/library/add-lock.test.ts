import { ADDED_MS, createAddLock } from './add-lock';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

function setup() {
  const shown: string[][] = [];
  const lock = createAddLock((added) => shown.push([...added]));
  return { lock, shown, last: () => shown.at(-1) ?? [] };
}

describe('createAddLock', () => {
  it('refuses a second tap while the first add is in flight', () => {
    const { lock } = setup();
    expect(lock.take('food:a')).toBe(true);
    expect(lock.take('food:a')).toBe(false);
    expect(lock.take('food:b')).toBe(true);
  });

  it('lets "＋" work again at once when the add failed', () => {
    const { lock, shown } = setup();
    lock.take('food:a');
    lock.release('food:a');
    expect(lock.take('food:a')).toBe(true);
    expect(shown).toEqual([]);
  });

  it('shows "✓" after an add, then "＋" again after a while', () => {
    const { lock, last } = setup();
    lock.take('food:a');
    lock.added('food:a');
    expect(last()).toEqual(['food:a']);
    expect(lock.take('food:a')).toBe(false);

    jest.advanceTimersByTime(ADDED_MS - 1);
    expect(lock.take('food:a')).toBe(false);
    jest.advanceTimersByTime(1);
    expect(last()).toEqual([]);
    expect(lock.take('food:a')).toBe(true);
  });

  it('forgets everything on reset, and ignores an add that finishes after it', () => {
    const { lock, last, shown } = setup();
    lock.take('food:a');
    lock.added('food:a');
    lock.take('meal:b');
    lock.reset();
    expect(last()).toEqual([]);
    expect(lock.take('food:a')).toBe(true);
    lock.release('food:a');

    const before = shown.length;
    lock.added('meal:b');
    expect(shown.length).toBe(before);
    jest.runAllTimers();
    expect(shown.length).toBe(before);
  });
});
