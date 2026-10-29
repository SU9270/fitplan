import { createInFlightGuard } from './in-flight';

describe('createInFlightGuard', () => {
  it('drops a call made while the previous one is still running', async () => {
    const run = createInFlightGuard();
    let release!: (value: string) => void;
    const task = jest.fn(() => new Promise<string>((resolve) => (release = resolve)));

    const first = run(task);
    const second = run(task);
    expect(await second).toBeNull();
    expect(task).toHaveBeenCalledTimes(1);

    release('saved');
    expect(await first).toBe('saved');
  });

  it('accepts a new call once the previous one settled, also after a failure', async () => {
    const run = createInFlightGuard();
    await expect(run(() => Promise.reject(new Error('offline')))).rejects.toThrow('offline');
    expect(await run(() => Promise.resolve(1))).toBe(1);
    expect(await run(() => Promise.resolve(2))).toBe(2);
  });
});
