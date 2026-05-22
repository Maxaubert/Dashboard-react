import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import { queryKeys } from './queryKeys';

/**
 * Resolves the logged-in user from the session cookie via /api/auth/me.
 * Returns `null` (not an error) when logged out, so callers can branch on
 * `data === null` to mean "anonymous". The whole app is guarded by
 * RequireAuth, so most pages can assume `data` is a User once rendered.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: authApi.me,
    // The session rarely changes within a tab; don't refetch aggressively.
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** Logout mutation: clears the server session, then resets the cache so
 *  the guard immediately bounces to /login. */
export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      // Drop all cached per-user data first so a later login doesn't see
      // the previous user's todos/notes/etc, then explicitly seed the
      // current user as null so RequireAuth redirects immediately without
      // a refetch flash.
      qc.clear();
      qc.setQueryData(queryKeys.currentUser, null);
    },
  });
}
