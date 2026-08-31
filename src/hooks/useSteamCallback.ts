import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui';
import { usePageOverlay } from '@/context/PageOverlayContext';
import { readSteamCallback, stripSteamParam } from '@/lib/steamCallback';
import { queryKeys } from './queryKeys';

/**
 * Handles the `?steam=connected|error` flag that `/api/steam/callback`
 * appends when it redirects back to `/`. Runs once on mount of the home
 * page: strips the query first (so a StrictMode double-run is a no-op),
 * toasts, refreshes the connection + wishlist queries on success, and opens
 * the Gaming overlay so the user lands where the wishlist lives.
 */
export function useSteamCallback() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { openOverlay } = usePageOverlay();

  useEffect(() => {
    const status = readSteamCallback(window.location.search);
    if (!status) return;
    window.history.replaceState({}, '', stripSteamParam(window.location.pathname, window.location.search));
    if (status === 'connected') {
      toast({ tone: 'success', title: 'Steam koblet til' });
      queryClient.invalidateQueries({ queryKey: queryKeys.steamConnection });
      queryClient.invalidateQueries({ queryKey: queryKeys.wishlist });
    } else {
      toast({ tone: 'danger', title: 'Kunne ikke koble til Steam' });
    }
    openOverlay('gaming');
  }, [queryClient, toast, openOverlay]);
}
