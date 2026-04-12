import { api } from './client';
import type { LinkItem } from './types';

export const linksApi = {
  list: () => api.get<LinkItem[]>('/links'),
  saveAll: (links: LinkItem[]) => api.post<{ ok: boolean }>('/links', links),
};
