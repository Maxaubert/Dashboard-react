import { api } from './client';
import type { HomeEnvelope } from './types';

export const homeApi = {
  list: (): Promise<HomeEnvelope> => api.get<HomeEnvelope>('/home'),
  saveAll: (envelope: HomeEnvelope): Promise<{ ok: boolean }> =>
    api.post<{ ok: boolean }>('/home', envelope),
};
