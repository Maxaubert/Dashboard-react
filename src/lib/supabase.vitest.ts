import { describe, it, expect } from 'vitest';
import { supabase } from './supabase';

describe('supabase client', () => {
  it('exposes the query + auth surface the app relies on', () => {
    expect(typeof supabase.from).toBe('function');
    expect(typeof supabase.auth.getSession).toBe('function');
    expect(typeof supabase.auth.signInWithPassword).toBe('function');
  });
});
