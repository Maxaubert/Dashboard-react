import { supabase } from '@/lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { User } from './types';

export function mapUser(u: SupabaseUser): User {
  return {
    id: u.id,
    email: u.email ?? '',
    display_name: (u.user_metadata?.display_name as string | undefined) ?? '',
  };
}

export const authApi = {
  me: async (): Promise<User | null> => {
    const { data } = await supabase.auth.getUser();
    return data.user ? mapUser(data.user) : null;
  },

  login: async (email: string, password: string): Promise<User> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new Error(error?.message ?? 'Innlogging feilet');
    return mapUser(data.user);
  },

  signup: async (input: { email: string; password: string; display_name: string }): Promise<User> => {
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { display_name: input.display_name } },
    });
    if (error || !data.user) throw new Error(error?.message ?? 'Registrering feilet');
    return mapUser(data.user);
  },

  logout: async (): Promise<void> => {
    await supabase.auth.signOut();
  },
};
