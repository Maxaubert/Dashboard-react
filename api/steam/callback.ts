import type { VercelRequest, VercelResponse } from '@vercel/node';
import { admin } from '../_lib/supabaseAdmin.js';
import { verifyState, extractSteamId, verifyWithSteam } from '../_lib/steamOpenid.js';

function baseUrl(req: VercelRequest): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const base = baseUrl(req);
  const fail = () => res.redirect(302, `${base}/gaming?steam=error`);
  try {
    const params = new URLSearchParams(req.query as Record<string, string>);
    const userId = verifyState(String(req.query.state ?? ''), process.env.STEAM_OPENID_SECRET as string, Date.now());
    if (!userId) return fail();
    if (!(await verifyWithSteam(params))) return fail();
    const steamId = extractSteamId(String(req.query['openid.claimed_id'] ?? ''));
    if (!steamId) return fail();
    const { error } = await admin
      .from('integrations')
      .upsert({ user_id: userId, steam_id: steamId, connected_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) return fail();
    res.redirect(302, `${base}/gaming?steam=connected`);
  } catch {
    fail();
  }
}
