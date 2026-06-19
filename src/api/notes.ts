import { supabase } from '@/lib/supabase';
import type { Note } from './types';

type Row = { id: string; title: string; body: string; updated_at: number };
const toNote = (r: Row): Note => ({ id: r.id, title: r.title, body: r.body, updatedAt: r.updated_at });

export const notesApi = {
  list: async (): Promise<Note[]> => {
    const { data, error } = await supabase
      .from('notes')
      .select('id,title,body,updated_at')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data as Row[]).map(toNote);
  },

  create: async (note: Omit<Note, 'id'>): Promise<Note> => {
    const row = {
      id: `note_${Date.now()}`,
      title: note.title ?? '',
      body: note.body ?? '',
      updated_at: typeof note.updatedAt === 'number' ? note.updatedAt : Date.now(),
    };
    const { data, error } = await supabase.from('notes').insert(row).select().single();
    if (error) throw error;
    return toNote(data as Row);
  },

  update: async (id: string, patch: Partial<Note>): Promise<Note> => {
    const upd: Partial<Row> = {};
    if (patch.title !== undefined) upd.title = patch.title;
    if (patch.body !== undefined) upd.body = patch.body;
    upd.updated_at = typeof patch.updatedAt === 'number' ? patch.updatedAt : Date.now();
    const { data, error } = await supabase.from('notes').update(upd).eq('id', id).select().single();
    if (error) throw error;
    return toNote(data as Row);
  },

  delete: async (id: string): Promise<{ ok: boolean }> => {
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) throw error;
    return { ok: true };
  },
};
