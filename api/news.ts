import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchNews } from './_lib/news';
import { getCached } from './_lib/cache';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = String(req.query.source ?? 'vg');
  const source: 'vg' | 'nrk' | 'aftenposten' =
    raw === 'nrk' || raw === 'aftenposten' ? raw : 'vg';
  const count = Number(req.query.count ?? 8);
  const offset = Number(req.query.offset ?? 0);
  try {
    const items = await getCached(`news:${source}`, 5 * 60_000, () => fetchNews(source));
    res.setHeader('Cache-Control', 's-maxage=300');
    res.status(200).json(items.slice(offset, offset + count));
  } catch {
    res.status(200).json([]); // news is non-critical; never break the home page
  }
}
