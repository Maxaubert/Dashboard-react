import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getSession, signUp } = vi.hoisted(() => ({ getSession: vi.fn(), signUp: vi.fn() }));
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession, signUp } },
}));

import { authApi, cacheUserForAuthEvent, mapUser } from './auth';

beforeEach(() => {
  getSession.mockReset();
  signUp.mockReset();
});

describe('mapUser', () => {
  it('maps a Supabase user to the app User shape', () => {
    const u = { id: 'uuid-123', email: 'a@b.com', user_metadata: { display_name: 'Max' } };
    expect(mapUser(u as never)).toEqual({ id: 'uuid-123', email: 'a@b.com', display_name: 'Max' });
  });
  it('falls back to empty display_name and email', () => {
    const u = { id: 'x', email: null, user_metadata: {} };
    expect(mapUser(u as never)).toEqual({ id: 'x', email: '', display_name: '' });
  });
});

describe('cacheUserForAuthEvent', () => {
  const session = { user: { id: 'u1', email: 'a@b.com', user_metadata: {} } } as never;

  it('skips INITIAL_SESSION with no session so me() decides between offline and logged out', () => {
    expect(cacheUserForAuthEvent('INITIAL_SESSION', null)).toBeUndefined();
  });

  it('seeds the user for INITIAL_SESSION, SIGNED_IN and TOKEN_REFRESHED', () => {
    for (const event of ['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED'] as const) {
      expect(cacheUserForAuthEvent(event, session)).toEqual({ id: 'u1', email: 'a@b.com', display_name: '' });
    }
  });

  it('clears the cache on SIGNED_OUT', () => {
    expect(cacheUserForAuthEvent('SIGNED_OUT', null)).toBeNull();
  });
});

describe('authApi.me', () => {
  const user = { id: 'u1', email: 'a@b.com', user_metadata: { display_name: 'Max' } };

  it('returns the user from the persisted session', async () => {
    getSession.mockResolvedValue({ data: { session: { user } }, error: null });
    expect(await authApi.me()).toEqual({ id: 'u1', email: 'a@b.com', display_name: 'Max' });
  });

  it('returns null when there is no session', async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    expect(await authApi.me()).toBeNull();
  });

  it('treats AuthSessionMissingError as logged out', async () => {
    const error = Object.assign(new Error('Auth session missing!'), {
      name: 'AuthSessionMissingError',
    });
    getSession.mockResolvedValue({ data: { session: null }, error });
    expect(await authApi.me()).toBeNull();
  });

  it('throws on non-session errors so the guard can show a retry state', async () => {
    const error = Object.assign(new Error('Failed to fetch'), {
      name: 'AuthRetryableFetchError',
    });
    getSession.mockResolvedValue({ data: { session: null }, error });
    await expect(authApi.me()).rejects.toBe(error);
  });
});

describe('authApi.signup', () => {
  const input = { email: 'a@b.com', password: 'p'.repeat(10), display_name: 'Max' };
  const user = { id: 'u1', email: 'a@b.com', user_metadata: { display_name: 'Max' } };

  it('returns the user and the session when Supabase logs the user in', async () => {
    const session = { access_token: 'tok', user };
    signUp.mockResolvedValue({ data: { user, session }, error: null });
    const result = await authApi.signup(input);
    expect(result.user).toEqual({ id: 'u1', email: 'a@b.com', display_name: 'Max' });
    expect(result.session).toBe(session);
  });

  it('returns a null session when e-mail confirmation is required', async () => {
    signUp.mockResolvedValue({ data: { user, session: null }, error: null });
    const result = await authApi.signup(input);
    expect(result.user.id).toBe('u1');
    expect(result.session).toBeNull();
  });

  it('throws the Supabase message on error', async () => {
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Signups not allowed for this instance' },
    });
    await expect(authApi.signup(input)).rejects.toThrow('Signups not allowed for this instance');
  });
});
