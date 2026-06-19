import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildWishlist } from './_lib/wishlist';
import { getCached } from './_lib/cache';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const env = {
    steamKey: process.env.STEAM_API_KEY as string,
    steamId: process.env.STEAM_ID as string,
    itadKey: process.env.ITAD_API_KEY as string,
  };
  try {
    const games = await getCached('wishlist', 60 * 60_000, () => buildWishlist(env));
    res.setHeader('Cache-Control', 's-maxage=3600');
    res.status(200).json(games);
  } catch {
    res.status(200).json([]);
  }
}
