import { useCallback, useState } from 'react';
import { steamApi } from '@/api/steam';
import { useToast } from '@/components/ui';

/**
 * Starts the Steam OpenID connect flow. `startConnect` navigates away on
 * success; on failure (login function down, expired session) it throws, so
 * surface a toast instead of a silent no-op. `pending` stays true after a
 * successful start because the page is about to unload.
 */
export function useSteamConnect() {
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  const connect = useCallback(async () => {
    setPending(true);
    try {
      await steamApi.startConnect();
    } catch {
      setPending(false);
      toast({ tone: 'danger', title: 'Kunne ikke starte Steam-innlogging' });
    }
  }, [toast]);

  return { connect, pending };
}
