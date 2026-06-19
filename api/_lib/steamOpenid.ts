import crypto from 'node:crypto';

const STEAM_OPENID = 'https://steamcommunity.com/openid/login';

function hmac(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function signState(userId: string, expMs: number, secret: string): string {
  const payload = `${userId}.${expMs}`;
  return `${payload}.${hmac(payload, secret)}`;
}

export function verifyState(state: string, secret: string, nowMs: number): string | null {
  const parts = state.split('.');
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const expected = hmac(`${userId}.${expStr}`, secret);
  // constant-time compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(expStr) < nowMs) return null;
  return userId;
}

export function buildAuthUrl(base: string, state: string): string {
  const returnTo = `${base}/api/steam/callback?state=${encodeURIComponent(state)}`;
  const qs = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': base,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });
  return `${STEAM_OPENID}?${qs.toString()}`;
}

export function extractSteamId(claimedId: string): string | null {
  const m = /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/.exec(claimedId);
  return m ? m[1] : null;
}

export async function verifyWithSteam(
  params: URLSearchParams,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const body = new URLSearchParams(params);
  body.set('openid.mode', 'check_authentication');
  const res = await fetchImpl(STEAM_OPENID, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) return false;
  const text = await res.text();
  return /^is_valid:true\s*$/m.test(text);
}
