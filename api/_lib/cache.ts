import { admin } from './supabaseAdmin.js';

export async function getCached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const { data: row } = await admin.from('cache').select('data,fetched_at').eq('key', key).maybeSingle();
  const fresh = row && Date.now() - new Date(row.fetched_at as string).getTime() < ttlMs;
  if (fresh) return row!.data as T;

  try {
    const data = await fetcher();
    await admin.from('cache').upsert({ key, data, fetched_at: new Date().toISOString() });
    return data;
  } catch (err) {
    if (row) return row.data as T; // serve stale on upstream failure
    throw err;
  }
}
