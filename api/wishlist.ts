import type { VercelRequest, VercelResponse } from '@vercel/node';
import { admin } from './_lib/supabaseAdmin.js';
import { buildWishlist, wishlistCacheKey } from './_lib/wishlist.js';
import { getCached } from './_lib/cache.js';

// ITAD enrichment adds an API call per game (lookup + history), so a large
// wishlist's first uncached build can exceed the default 10s. Give it room.
export const config = { maxDuration: 60 };

/** How long a built wishlist is served from the cache table. */
const WISHLIST_TTL_MS = 10 * 60_000;

/**
 * `?refresh=1` rate limit: a cached row younger than this is returned as-is
 * even when a refresh is requested, so a click-happy user cannot hammer Steam
 * and ITAD. Older rows are rebuilt and written back like a normal miss.
 */
const REFRESH_MIN_AGE_MS = 60_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const { data: udata, error: uerr } = await admin.auth.getUser(token);
  if (uerr || !udata.user) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const { data: row } = await admin
    .from('integrations')
    .select('steam_id')
    .eq('user_id', udata.user.id)
    .maybeSingle();
  if (!row?.steam_id) {
    res.status(200).json({ connected: false, games: [] });
    return;
  }
  const steamKey = process.env.STEAM_API_KEY;
  if (!steamKey) {
    res.status(500).json({ error: 'STEAM_API_KEY is not configured' });
    return;
  }
  const steamId = row.steam_id as string;
  const env = {
    steamKey,
    steamId,
    itadKey: process.env.ITAD_API_KEY || '',
  };
  // A refresh bypasses the cached row by shrinking its TTL to the rate-limit
  // window; the rebuilt list is still written back for everyone else.
  const refresh = String(req.query.refresh ?? '') === '1';
  const ttlMs = refresh ? REFRESH_MIN_AGE_MS : WISHLIST_TTL_MS;
  try {
    // Key by steamId too, so re-linking another account inside the TTL does
    // not keep serving the previous account's list.
    const games = await getCached(wishlistCacheKey(udata.user.id, steamId), ttlMs, () =>
      buildWishlist(env, fetch, getCached),
    );
    res.status(200).json({ connected: true, games });
  } catch {
    // getCached only throws when there is no cached row to fall back on;
    // nothing is written to the cache in that case.
    res.status(200).json({ connected: true, games: [] });
  }
}
