import type { VercelRequest, VercelResponse } from '@vercel/node';
import { admin } from './_lib/supabaseAdmin.js';
import { buildWishlist } from './_lib/wishlist.js';
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
  const env = {
    steamKey: process.env.STEAM_API_KEY as string,
    steamId: row.steam_id as string,
    itadKey: (process.env.ITAD_API_KEY as string) || '',
  };
  try {
    const games = await getCached(`wishlist:${udata.user.id}`, 60 * 60_000, () => buildWishlist(env));
    res.status(200).json({ connected: true, games });
  } catch {
    res.status(200).json({ connected: true, games: [] });
  }
}
