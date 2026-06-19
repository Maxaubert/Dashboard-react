import { describe, it, expect } from 'vitest';
import { mapUser } from './auth';

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
