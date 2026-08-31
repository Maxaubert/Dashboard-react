import { describe, it, expect, vi } from 'vitest';
import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { bulkSaveMutation } from './bulkSaveMutation';

const KEY = ['docs'] as const;

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(prepare?: (raw: string[]) => string[]) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  qc.setQueryData(KEY, ['a']);
  const pending: ReturnType<typeof deferred<unknown>>[] = [];
  const save = vi.fn((_next: string[]) => {
    const d = deferred<unknown>();
    pending.push(d);
    return d.promise;
  });
  const invalidate = vi.spyOn(qc, 'invalidateQueries');
  const options = bulkSaveMutation<string[]>(qc, KEY, save, prepare);
  const observer = new MutationObserver(qc, options);
  const mutate = (next: string[]) => observer.mutate(next).catch(() => {});
  return { qc, save, pending, invalidate, mutate };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('bulkSaveMutation', () => {
  it('writes the optimistic cache synchronously so back-to-back saves stack', async () => {
    const { qc, mutate } = setup();
    mutate(['a', 'b']);
    expect(qc.getQueryData(KEY)).toEqual(['a', 'b']);
    mutate([...(qc.getQueryData<string[]>(KEY) ?? []), 'c']);
    expect(qc.getQueryData(KEY)).toEqual(['a', 'b', 'c']);
  });

  it('serialises the network saves in call order', async () => {
    const { save, pending, mutate } = setup();
    mutate(['a', 'b']);
    mutate(['a', 'b', 'c']);
    await flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenLastCalledWith(['a', 'b']);

    pending[0].resolve({ ok: true });
    await flush();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith(['a', 'b', 'c']);
  });

  it('only invalidates after the last queued save settles', async () => {
    const { invalidate, pending, mutate } = setup();
    mutate(['a', 'b']);
    mutate(['a', 'b', 'c']);
    await flush();

    pending[0].resolve({ ok: true });
    await flush();
    expect(invalidate).not.toHaveBeenCalled();

    pending[1].resolve({ ok: true });
    await flush();
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: KEY });
  });

  it('rolls the cache back when a save fails', async () => {
    const { qc, pending, mutate } = setup();
    mutate(['a', 'b']);
    await flush();
    pending[0].reject(new Error('boom'));
    await flush();
    expect(qc.getQueryData(KEY)).toEqual(['a']);
  });

  it('applies prepare to both the cache write and the payload', async () => {
    const upper = (list: string[]) => list.map((s) => s.toUpperCase());
    const { qc, save, mutate } = setup(upper);
    mutate(['x']);
    expect(qc.getQueryData(KEY)).toEqual(['X']);
    await flush();
    expect(save).toHaveBeenCalledWith(['X']);
  });
});
