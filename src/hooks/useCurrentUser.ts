import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, cacheUserForAuthEvent } from '@/api/auth';
import { supabase } from '@/lib/supabase';
import { queryKeys } from './queryKeys';

/**
 * Resolves the current user from the persisted Supabase session
 * (`supabase.auth.getSession()`). Returns `null` (not an error) when logged
 * out, so callers can branch on `data === null` to mean "anonymous". A
 * network failure surfaces as `isError`; RequireAuth shows a retry state for
 * that rather than redirecting. The whole app is guarded by RequireAuth, so
 * most pages can assume `data` is a User once rendered.
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

/** Logout mutation: clears the Supabase session, then resets the cache so
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

/**
 * Subscribe React Query to Supabase auth changes (call once, in App).
 * INITIAL_SESSION with a session, TOKEN_REFRESHED and SIGNED_IN seed the
 * cache without another probe; SIGNED_OUT (also fired when the client drops
 * a dead refresh token) clears it. INITIAL_SESSION with a null session is
 * ignored: auth-js emits that for any load failure, offline included, and
 * only `authApi.me()` can tell "no session" from "could not check", which
 * RequireAuth relies on for its retry state. See `cacheUserForAuthEvent`.
 */
export function useAuthSync() {
  const qc = useQueryClient();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const user = cacheUserForAuthEvent(event, session);
      if (user !== undefined) qc.setQueryData(queryKeys.currentUser, user);
    });
    return () => data.subscription.unsubscribe();
  }, [qc]);
}
