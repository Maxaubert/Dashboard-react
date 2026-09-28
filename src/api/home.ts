import { readDoc, writeDoc } from '@/lib/docStore';
import type { HomeEnvelope } from './types';

const EMPTY_HOME: HomeEnvelope = { version: 1, sections: [], hidden: [], widgets: [], habits: [] };

export const homeApi = {
  list: () => readDoc<HomeEnvelope>('home', EMPTY_HOME),
  saveAll: async (envelope: HomeEnvelope) => {
    await writeDoc('home', envelope);
    return { ok: true };
  },
};
