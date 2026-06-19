import { supabase } from '@/lib/supabase';

export type DocKind = 'todos' | 'plan' | 'links' | 'home';

/** Read a per-user JSONB document, or `fallback` if the user has no row yet. */
export async function readDoc<T>(kind: DocKind, fallback: T): Promise<T> {
  const { data, error } = await supabase
    .from('documents')
    .select('data')
    .eq('kind', kind)
    .maybeSingle();
  if (error) throw error;
  return (data?.data as T | undefined) ?? fallback;
}

/** Upsert the per-user document. user_id is filled by the column default. */
export async function writeDoc<T>(kind: DocKind, data: T): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .upsert({ kind, data }, { onConflict: 'user_id,kind' });
  if (error) throw error;
}
