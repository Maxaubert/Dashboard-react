import type { VercelRequest, VercelResponse } from '@vercel/node';
import { admin } from './_lib/supabaseAdmin.js';
import { buildWishlist, wishlistCacheKey } from './_lib/wishlist.js';
import { getCached } from './_lib/cache.js';

// ITAD enrichment adds an API call per game (lookup + history), so a large
// wishlist's first uncached build can exceed the default 10s. Give it room.
export const config = { maxDuration: 60 };

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
  try {
    // Key by steamId too, so re-linking another account inside the TTL does
    // not keep serving the previous account's list.
    const games = await getCached(wishlistCacheKey(udata.user.id, steamId), 60 * 60_000, () => buildWishlist(env));
    res.status(200).json({ connected: true, games });
  } catch {
    // getCached only throws when there is no cached row to fall back on;
    // nothing is written to the cache in that case.
    res.status(200).json({ connected: true, games: [] });
  }
}
