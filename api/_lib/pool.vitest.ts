import { describe, it, expect } from 'vitest';
import { mapWithConcurrency } from './pool';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('mapWithConcurrency', () => {
  it('returns results in input order even when later items finish first', async () => {
    const gates = [0, 1, 2, 3, 4].map(() => deferred<void>());
    const out = mapWithConcurrency([0, 1, 2, 3, 4], 2, async (n) => {
      await gates[n].promise;
      return n * 10;
    });
    // Finish in reverse-ish order.
    gates[1].resolve(); await flush();
    gates[0].resolve(); await flush();
    gates[3].resolve(); await flush();
    gates[2].resolve(); await flush();
    gates[4].resolve();
    expect(await out).toEqual([0, 10, 20, 30, 40]);
  });

  it('never runs more than `limit` calls at once', async () => {
    const gates = Array.from({ length: 20 }, () => deferred<void>());
    let inFlight = 0;
    let maxInFlight = 0;
    const out = mapWithConcurrency(gates, 8, async (g) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await g.promise;
      inFlight--;
      return true;
    });
    await flush();
    expect(inFlight).toBe(8);
    for (const g of gates) { g.resolve(); await flush(); }
    await out;
    expect(maxInFlight).toBe(8);
  });

  it('passes the index and handles an empty list', async () => {
    expect(await mapWithConcurrency([], 8, async () => 1)).toEqual([]);
    expect(await mapWithConcurrency(['a', 'b'], 8, async (_x, i) => i)).toEqual([0, 1]);
  });

  it('rejects when fn rejects', async () => {
    await expect(
      mapWithConcurrency([1, 2], 2, async (n) => { if (n === 2) throw new Error('boom'); return n; }),
    ).rejects.toThrow('boom');
  });

  it('rejects an invalid limit', async () => {
    await expect(mapWithConcurrency([1], 0, async (n) => n)).rejects.toThrow(RangeError);
  });
});
