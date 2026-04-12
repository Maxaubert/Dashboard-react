import { api } from './client';
import type { PlanItem } from './types';

export const planApi = {
  list: () => api.get<PlanItem[]>('/plan'),
  saveAll: (items: PlanItem[]) => api.post<{ ok: boolean }>('/plan', items),
};
