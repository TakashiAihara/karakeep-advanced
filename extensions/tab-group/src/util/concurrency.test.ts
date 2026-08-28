import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from './concurrency';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('mapWithConcurrency', () => {
  it('returns an empty array and never calls the worker for empty input', async () => {
    let calls = 0;
    const results = await mapWithConcurrency(
      [],
      async () => {
        calls++;
        return 'x';
      },
      3,
    );
    expect(results).toEqual([]);
    expect(calls).toBe(0);
  });

  it('processes every item once when concurrency exceeds the item count', async () => {
    const seen: number[] = [];
    let inFlight = 0;
    let maxInFlight = 0;

    const results = await mapWithConcurrency(
      [10, 20, 30],
      async (item) => {
        seen.push(item);
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await delay(0);
        inFlight--;
        return item / 10;
      },
      99,
    );

    expect(results).toEqual([1, 2, 3]);
    expect(seen).toEqual([10, 20, 30]);
    expect(maxInFlight).toBe(3);
  });

  it('passes the index of each item to the worker', async () => {
    const results = await mapWithConcurrency(['a', 'b', 'c'], async (item, index) => `${index}${item}`, 2);
    expect(results).toEqual(['0a', '1b', '2c']);
  });

  it('keeps results in input order when workers finish out of order', async () => {
    const gates = [deferred<string>(), deferred<string>(), deferred<string>()];
    const promise = mapWithConcurrency(
      [0, 1, 2],
      async (_item, index) => gates[index]!.promise,
      3,
    );

    gates[2]!.resolve('third');
    gates[0]!.resolve('first');
    gates[1]!.resolve('second');

    expect(await promise).toEqual(['first', 'second', 'third']);
  });

  it('never runs more than the requested number of workers at once', async () => {
    const items = [0, 1, 2, 3, 4, 5, 6];
    let inFlight = 0;
    let maxInFlight = 0;

    const results = await mapWithConcurrency(
      items,
      async (item) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await delay(1);
        inFlight--;
        return item * 2;
      },
      3,
    );

    expect(results).toEqual([0, 2, 4, 6, 8, 10, 12]);
    expect(maxInFlight).toBe(3);
  });

  // NOTE: a rejection is not a cancellation. Only the runner that threw stops pulling items;
  // its siblings drain the rest of the queue after the returned promise has already rejected.
  it('rejects on the first worker failure while sibling workers keep draining the queue', async () => {
    const items = [0, 1, 2, 3, 4, 5];
    const attempted: number[] = [];
    let finished = 0;
    const allSettled = deferred<void>();

    const promise = mapWithConcurrency(
      items,
      async (item) => {
        attempted.push(item);
        try {
          await delay(1);
          if (item === 1) throw new Error('worker 1 failed');
          return item;
        } finally {
          finished++;
          if (finished === items.length) allSettled.resolve();
        }
      },
      2,
    );

    await expect(promise).rejects.toThrow('worker 1 failed');

    await allSettled.promise;
    expect(attempted).toEqual(items);
  });

  it('surfaces the earliest rejection and swallows later ones', async () => {
    let finished = 0;
    const allSettled = deferred<void>();

    const promise = mapWithConcurrency(
      [0, 1],
      async (item) => {
        try {
          await delay(item === 0 ? 20 : 0);
          throw new Error(`worker ${item} failed`);
        } finally {
          finished++;
          if (finished === 2) allSettled.resolve();
        }
      },
      2,
    );

    await expect(promise).rejects.toThrow('worker 1 failed');
    await allSettled.promise;
  });

  it('resolves without calling the worker when concurrency is zero', async () => {
    let calls = 0;
    const results = await mapWithConcurrency(
      [1, 2],
      async (item) => {
        calls++;
        return item;
      },
      0,
    );

    expect(calls).toBe(0);
    expect(results).toHaveLength(2);
    expect(results[0]).toBeUndefined();
  });
});
