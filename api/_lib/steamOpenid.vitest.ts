import { describe, it, expect } from 'vitest';
import { signState, verifyState, extractSteamId, buildAuthUrl, verifyWithSteam } from './steamOpenid.js';

const SECRET = 'test-secret';

describe('state sign/verify', () => {
  it('round-trips a valid, unexpired state', () => {
    const exp = 10_000;
    const s = signState('user-1', exp, SECRET);
    expect(verifyState(s, SECRET, 9_000)).toBe('user-1');
  });
  it('rejects an expired state', () => {
    const s = signState('user-1', 10_000, SECRET);
    expect(verifyState(s, SECRET, 11_000)).toBeNull();
  });
  it('rejects a tampered state', () => {
    const s = signState('user-1', 10_000, SECRET);
    const tampered = s.replace('user-1', 'user-2');
    expect(verifyState(tampered, SECRET, 9_000)).toBeNull();
  });
  it('rejects a wrong secret', () => {
    const s = signState('user-1', 10_000, SECRET);
    expect(verifyState(s, 'other', 9_000)).toBeNull();
  });
});

describe('extractSteamId', () => {
  it('pulls the 17-digit id from a claimed_id url', () => {
    expect(extractSteamId('https://steamcommunity.com/openid/id/76561197960287930')).toBe('76561197960287930');
  });
  it('returns null for a non-matching url', () => {
    expect(extractSteamId('https://example.com/foo')).toBeNull();
  });
});

describe('buildAuthUrl', () => {
  it('targets steam OpenID with our return_to + realm', () => {
    const url = buildAuthUrl('https://app.example.com', 'STATE');
    expect(url.startsWith('https://steamcommunity.com/openid/login?')).toBe(true);
    const qs = new URL(url).searchParams;
    expect(qs.get('openid.mode')).toBe('checkid_setup');
    expect(qs.get('openid.return_to')).toBe('https://app.example.com/api/steam/callback?state=STATE');
    expect(qs.get('openid.realm')).toBe('https://app.example.com');
  });
});

describe('verifyWithSteam', () => {
  it('returns true when Steam says is_valid:true', async () => {
    const stub = (async () => ({ ok: true, text: async () => 'ns:...\nis_valid:true\n' })) as unknown as typeof fetch;
    const params = new URLSearchParams({ 'openid.sig': 'x' });
    expect(await verifyWithSteam(params, stub)).toBe(true);
  });
  it('returns false otherwise', async () => {
    const stub = (async () => ({ ok: true, text: async () => 'is_valid:false\n' })) as unknown as typeof fetch;
    expect(await verifyWithSteam(new URLSearchParams(), stub)).toBe(false);
  });
  it('returns false on a non-ok response', async () => {
    const stub = (async () => ({ ok: false, text: async () => 'is_valid:true\n' })) as unknown as typeof fetch;
    expect(await verifyWithSteam(new URLSearchParams(), stub)).toBe(false);
  });
});
