import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWishlist, useSteamConnection, useRefreshWishlist } from '@/hooks/useWishlist';
import { useSteamConnect } from '@/hooks/useSteamConnect';
import { queryKeys } from '@/hooks/queryKeys';
import { steamApi } from '@/api/steam';
import type { WishlistGame } from '@/api/types';
import { filterGames } from '@/lib/wishlistSearch';
import { useToast } from '@/components/ui';
import { GameModal } from '@/components/gaming/GameModal';
import { GameSections } from '@/components/gaming/GameSections';
import { GamingSearchBar } from '@/components/gaming/GamingSearchBar';

export function GamingPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: conn } = useSteamConnection();
  const { data: wl, isLoading, error } = useWishlist();
  const { connect, pending: connecting } = useSteamConnect();
  const { refresh, pending: refreshing } = useRefreshWishlist();
  const [query, setQuery] = useState('');
  const [activeGame, setActiveGame] = useState<WishlistGame | null>(null);

  const connected = wl?.connected ?? conn?.connected ?? false;
  const games = useMemo(() => wl?.games ?? [], [wl?.games]);
  const searching = query.trim().length > 0;
  const ready = !isLoading && !error && games.length > 0;

  const filtered = useMemo(() => filterGames(games, query), [games, query]);
  const onSale = useMemo(
    () => filtered.filter((g) => g.onSale).sort((a, b) => b.discount - a.discount),
    [filtered]
  );
  const regular = useMemo(() => filtered.filter((g) => !g.onSale), [filtered]);

  // The `?steam=connected|error` return from the OpenID callback is handled
  // by `useSteamCallback` on HomePage; this overlay never sees the query.

  function handleRefresh() {
    refresh(undefined, {
      onError: () => toast({ tone: 'danger', title: 'Kunne ikke oppdatere ønskelisten' }),
    });
  }

  async function handleDisconnect() {
    try {
      await steamApi.disconnect();
      queryClient.invalidateQueries({ queryKey: queryKeys.steamConnection });
      queryClient.invalidateQueries({ queryKey: queryKeys.wishlist });
      toast({ tone: 'neutral', title: 'Steam frakoblet' });
    } catch {
      toast({ tone: 'danger', title: 'Kunne ikke koble fra Steam' });
    }
  }

  const subtitle = isLoading
    ? 'Laster…'
    : games.length === 0
    ? connected
      ? '0 spill'
      : 'Ikke koblet til Steam'
    : searching
    ? `${filtered.length} av ${games.length} spill · ${onSale.length} på salg`
    : `${games.length} spill · ${onSale.length} på salg`;

  return (
    <div className="gaming-page">
      <div className="page-header">
        <div className="page-header-eyebrow">Gaming</div>
        <div className="page-header-title">Steam ønskeliste</div>
        <div className="page-header-sub">{subtitle}</div>
      </div>

      {connected && (
        <GamingSearchBar
          query={query}
          onQueryChange={setQuery}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          disabled={!ready}
          trailing={
            <button type="button" className="gaming-filter-btn gaming-disconnect-btn" onClick={handleDisconnect}>
              Koble fra
            </button>
          }
        />
      )}

      {!connected && !isLoading ? (
        <div className="gaming-state-box">
          <p>Koble til Steam for å vise ønskelisten din.</p>
          <p style={{ opacity: 0.7, fontSize: '0.85rem', marginTop: '0.5rem' }}>
            Ønskelisten din på Steam må være satt til offentlig.
          </p>
          <button
            type="button"
            className="gaming-filter-btn active"
            style={{ marginTop: '1rem' }}
            onClick={connect}
            disabled={connecting}
          >
            Koble til Steam
          </button>
        </div>
      ) : error ? (
        <div className="gaming-state-box">Kunne ikke laste ønskeliste.</div>
      ) : isLoading ? (
        <div className="gaming-state-box">Laster ønskeliste…</div>
      ) : games.length === 0 ? (
        <div className="gaming-state-box">Ønskelisten er tom (er den satt til offentlig på Steam?).</div>
      ) : filtered.length === 0 ? (
        <div className="gaming-state-box">
          <p>Ingen treff for «{query.trim()}»</p>
          <button
            type="button"
            className="gaming-filter-btn"
            style={{ marginTop: '1rem' }}
            onClick={() => setQuery('')}
          >
            Tøm søk
          </button>
        </div>
      ) : (
        <GameSections onSale={onSale} regular={regular} onSelect={setActiveGame} />
      )}

      {activeGame && <GameModal game={activeGame} onClose={() => setActiveGame(null)} />}
    </div>
  );
}
