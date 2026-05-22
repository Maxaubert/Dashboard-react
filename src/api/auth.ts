import { api, ApiError } from './client';
import type { User } from './types';

/**
 * Auth client for the Phase 2 backend endpoints. The session lives in an
 * HttpOnly cookie set by the server, so there's no token to store here;
 * `client.ts` already sends `credentials: 'include'` on every request.
 */
export const authApi = {
  /** Resolve the current user, or null if not logged in (401). */
  me: async (): Promise<User | null> => {
    try {
      const { user } = await api.get<{ user: User }>('/auth/me');
      return user;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },

  login: async (email: string, password: string): Promise<User> => {
    const { user } = await api.post<{ user: User }>('/auth/login', { email, password });
    return user;
  },

  signup: async (input: {
    code: string;
    email: string;
    password: string;
    display_name: string;
  }): Promise<User> => {
    const { user } = await api.post<{ user: User }>('/auth/signup', input);
    return user;
  },

  logout: (): Promise<void> => api.post<void>('/auth/logout'),
};
