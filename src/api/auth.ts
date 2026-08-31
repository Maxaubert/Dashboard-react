import { supabase } from '@/lib/supabase';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import type { User } from './types';

export function mapUser(u: SupabaseUser): User {
  return {
    id: u.id,
    email: u.email ?? '',
    display_name: (u.user_metadata?.display_name as string | undefined) ?? '',
  };
}

/** Result of `authApi.signup`. `session` is null when Supabase requires the
 *  user to confirm the e-mail before the account can be used. */
export interface SignupResult {
  user: User;
  session: Session | null;
}

export const authApi = {
  /**
   * Resolves the current user from the persisted Supabase session.
   * `getSession()` reads localStorage and only hits the network when the
   * access token needs a refresh. Returns `null` for "logged out" and throws
   * for anything else (offline, refresh endpoint down), so the caller can
   * show a retry state instead of bouncing to /login.
   */
  me: async (): Promise<User | null> => {
    const { data, error } = await supabase.auth.getSession();
    if (error && error.name !== 'AuthSessionMissingError') throw error;
    return data.session?.user ? mapUser(data.session.user) : null;
  },

  login: async (email: string, password: string): Promise<User> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new Error(error?.message ?? 'Innlogging feilet');
    return mapUser(data.user);
  },

  signup: async (input: {
    email: string;
    password: string;
    display_name: string;
  }): Promise<SignupResult> => {
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { display_name: input.display_name } },
    });
    if (error || !data.user) throw new Error(error?.message ?? 'Registrering feilet');
    return { user: mapUser(data.user), session: data.session };
  },

  logout: async (): Promise<void> => {
    await supabase.auth.signOut();
  },
};
