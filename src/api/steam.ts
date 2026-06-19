import { supabase } from '@/lib/supabase';

async function bearer(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

export const steamApi = {
  getConnection: async (): Promise<{ connected: boolean; steamId: string | null }> => {
    const { data, error } = await supabase.from('integrations').select('steam_id').maybeSingle();
    if (error) throw error;
    return { connected: !!data?.steam_id, steamId: (data?.steam_id as string) ?? null };
  },

  startConnect: async (): Promise<void> => {
    const res = await fetch('/api/steam/login', { headers: { Authorization: `Bearer ${await bearer()}` } });
    if (!res.ok) throw new Error(`steam login ${res.status}`);
    const { url } = (await res.json()) as { url: string };
    window.location.href = url;
  },

  disconnect: async (): Promise<void> => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { error } = await supabase.from('integrations').delete().eq('user_id', data.user.id);
    if (error) throw error;
  },
};
