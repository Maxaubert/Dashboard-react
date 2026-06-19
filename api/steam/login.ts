import type { VercelRequest, VercelResponse } from '@vercel/node';
import { admin } from '../_lib/supabaseAdmin.js';
import { signState, buildAuthUrl } from '../_lib/steamOpenid.js';

function baseUrl(req: VercelRequest): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const secret = process.env.STEAM_OPENID_SECRET as string;
  const state = signState(data.user.id, Date.now() + 10 * 60_000, secret);
  res.status(200).json({ url: buildAuthUrl(baseUrl(req), state) });
}
