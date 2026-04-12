import { api } from './client';
import type { SkoleData } from './types';

export const skoleApi = {
  /** GET /api/skole — server caches Canvas LMS data for 30 minutes. */
  get: () => api.get<SkoleData>('/skole', { timeoutMs: 15000 }),
};
