import { admin } from './supabaseAdmin.js';

/**
 * Time-to-live for a cached row. A function lets the TTL depend on the cached
 * value itself (for example a short TTL for a "not found" result so it is
 * retried sooner than a hit).
 */
export type CacheTtl<T> = number | ((data: T) => number);

/** Signature shared by getCached and any test double injected in its place. */
export type CacheReader = <T>(key: string, ttlMs: CacheTtl<T>, fetcher: () => Promise<T>) => Promise<T>;

export async function getCached<T>(key: string, ttlMs: CacheTtl<T>, fetcher: () => Promise<T>): Promise<T> {
  const { data: row } = await admin.from('cache').select('data,fetched_at').eq('key', key).maybeSingle();
  if (row) {
    const ttl = typeof ttlMs === 'function' ? ttlMs(row.data as T) : ttlMs;
    const fresh = Date.now() - new Date(row.fetched_at as string).getTime() < ttl;
    if (fresh) return row.data as T;
  }

  try {
    const data = await fetcher();
    await admin.from('cache').upsert({ key, data, fetched_at: new Date().toISOString() });
    return data;
  } catch (err) {
    if (row) return row.data as T; // serve stale on upstream failure
    throw err;
  }
}
