import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWishlist, useSteamConnection } from '@/hooks/useWishlist';
import { queryKeys } from '@/hooks/queryKeys';
import { steamApi } from '@/api/steam';
import type { WishlistGame } from '@/api/types';
import { GAMING_EVENTS, type GamingEvent } from '@/data/gamingEvents';
import { cn } from '@/lib/cn';
import { PTAG_LABEL, ptagsArr } from '@/lib/gaming';
import { useToast } from '@/components/ui';
import { GameModal } from '@/components/gaming/GameModal';

type Tab = 'wishlist' | 'events';

export function GamingPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: conn } = useSteamConnection();
  const { data: wl, isLoading, error } = useWishlist();
  const [tab, setTab] = useState<Tab>('wishlist');
  const [activeGame, setActiveGame] = useState<WishlistGame | null>(null);

  const connected = wl?.connected ?? conn?.connected ?? false;
  const games = wl?.games ?? [];

  const onSale = useMemo(
    () => games.filter((g) => g.onSale).sort((a, b) => b.discount - a.discount),
    [games]
  );
  const regular = useMemo(() => games.filter((g) => !g.onSale), [games]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('steam');
    if (p === 'connected') {
      toast({ tone: 'success', title: 'Steam koblet til' });
    }
    if (p === 'error') {
      toast({ tone: 'danger', title: 'Kunne ikke koble til Steam' });
    }
    if (p) window.history.replaceState({}, '', '/gaming');
  }, [toast]);

  async function handleDisconnect() {
    try {
      await steamApi.disconnect();
      queryClient.invalidateQueries({ queryKey: ['steam-connection'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.wishlist });
      toast({ tone: 'neutral', title: 'Steam frakoblet' });
    } catch {
      toast({ tone: 'danger', title: 'Kunne ikke koble fra Steam' });
    }
  }

  return (
    <div className="gaming-page">
      <div className="page-header">
        <div className="page-header-eyebrow">Gaming</div>
        <div className="page-header-title">Steam ønskeliste</div>
        <div className="page-header-sub">
          {isLoading
            ? 'Laster…'
            : games.length > 0
            ? `${games.length} spill · ${onSale.length} på salg nå`
            : connected
            ? '0 spill'
            : 'Ikke koblet til Steam'}
        </div>
      </div>

      <div className="gaming-filter-bar">
        <button
          className={cn('gaming-filter-btn', tab === 'wishlist' && 'active')}
          onClick={() => setTab('wishlist')}
        >
          Ønskeliste
        </button>
        <button
          className={cn('gaming-filter-btn', tab === 'events' && 'active')}
          onClick={() => setTab('events')}
        >
          Hendelser
        </button>
        {tab === 'wishlist' && games.length > 0 && (
          <span className="gaming-filter-count">{games.length} spill</span>
        )}
        {connected && (
          <button
            className="gaming-filter-btn"
            style={{ marginLeft: 'auto', opacity: 0.7, fontSize: '0.8rem' }}
            onClick={handleDisconnect}
          >
            Koble fra
          </button>
        )}
      </div>

      {tab === 'wishlist' ? (
        !connected && !isLoading ? (
          <div className="gaming-state-box">
            <p>Koble til Steam for å vise ønskelisten din.</p>
            <p style={{ opacity: 0.7, fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Ønskelisten din på Steam må være satt til offentlig.
            </p>
            <button
              className="gaming-filter-btn active"
              style={{ marginTop: '1rem' }}
              onClick={() => steamApi.startConnect()}
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
        ) : (
          <>
            {onSale.length > 0 && (
              <>
                <div className="gaming-section-label">På salg nå — {onSale.length} spill</div>
                <div className="games-grid">
                  {onSale.map((g) => (
                    <GameCard key={g.appid} game={g} onClick={() => setActiveGame(g)} />
                  ))}
                </div>
                {regular.length > 0 && (
                  <div className="gaming-section-label">Resten av ønskelisten</div>
                )}
              </>
            )}
            {regular.length > 0 && (
              <div className="games-grid">
                {regular.map((g) => (
                  <GameCard key={g.appid} game={g} onClick={() => setActiveGame(g)} />
                ))}
              </div>
            )}
          </>
        )
      ) : (
        <EventsTab />
      )}

      {activeGame && <GameModal game={activeGame} onClose={() => setActiveGame(null)} />}
    </div>
  );
}

/* ── Game card ───────────────────────────────────────────────────────────── */
function GameCard({ game, onClick }: { game: WishlistGame; onClick: () => void }) {
  const tags = ptagsArr(game);
  return (
    <div className={cn('game-card', game.onSale && 'on-sale')} onClick={onClick} role="button" tabIndex={0}>
      <div className="game-img-wrap">
        <img
          className="game-img"
          src={game.imgUrl}
          alt={game.name}
          loading="lazy"
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            if (game.imgFallback && img.src !== game.imgFallback) img.src = game.imgFallback;
            else img.style.display = 'none';
          }}
        />
        {tags.length > 0 && (
          <div className="img-ptags">
            {tags.map((t) => {
              const def = PTAG_LABEL[t] ?? { cls: 'ptag-good', label: t };
              return (
                <span key={t} className={cn('ptag', def.cls)}>
                  {def.label}
                </span>
              );
            })}
          </div>
        )}
      </div>
      <div className="game-info">
        <div className="game-name">{game.name}</div>
        <div className="game-tags">
          {game.genres.map((t) => (
            <span key={t} className="game-tag">{t}</span>
          ))}
        </div>
      </div>
      <div className="game-price-col">
        {game.onSale && <span className="sale-badge">-{game.discount}%</span>}
        {game.onSale && game.origPrice && (
          <span className="game-orig-price">{game.origPrice}</span>
        )}
        {game.isFree ? (
          <span className="game-price free">Gratis</span>
        ) : game.price ? (
          <span className="game-price">{game.price}</span>
        ) : (
          <span className="price-na">Ikke tilgjengelig</span>
        )}
      </div>
    </div>
  );
}

/* ── Events tab ──────────────────────────────────────────────────────────── */
function EventsTab() {
  const now = Date.now();
  const upcoming = GAMING_EVENTS.filter((e) => e.end.getTime() > now);
  const past = GAMING_EVENTS.filter((e) => e.end.getTime() <= now);

  return (
    <div>
      {upcoming.length > 0 ? (
        <div className="gaming-events-list">
          {upcoming.map((e) => (
            <GamingEventCard key={e.name} event={e} now={now} />
          ))}
        </div>
      ) : (
        <div className="gaming-state-box">Ingen kommende hendelser funnet.</div>
      )}
      {past.length > 0 && (
        <>
          <div className="events-past-label">Tidligere</div>
          <div className="gaming-events-list">
            {past.map((e) => (
              <GamingEventCard key={e.name} event={e} now={now} isPast />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function GamingEventCard({ event, now, isPast }: { event: GamingEvent; now: number; isPast?: boolean }) {
  const isLive = !isPast && event.start.getTime() <= now;
  const isSoon = !isPast && !isLive && event.start.getTime() - now < 7 * 86_400_000;

  const oslo = (date: Date, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('nb-NO', { timeZone: 'Europe/Oslo', ...opts }).format(date);

  const dayNum = oslo(event.start, { day: 'numeric' });
  const monStr = oslo(event.start, { month: 'short' });
  const timeStr = oslo(event.start, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
  const endStr = event.start.toDateString() !== event.end.toDateString()
    ? ' – ' + oslo(event.end, { day: 'numeric', month: 'long' })
    : '';

  return (
    <a
      href={event.url}
      target="_blank"
      rel="noreferrer noopener"
      className={cn('gaming-event-card', isPast && 'past', isLive && 'live')}
    >
      <div className="gaming-event-date-col">
        <div className="gaming-event-date-day">{dayNum}</div>
        <div className="gaming-event-date-mon">{monStr}</div>
      </div>
      <div className="gaming-event-info">
        <div className="gaming-event-name">{event.name}</div>
        <div className="gaming-event-time">
          {timeStr}
          {endStr} (norsk tid)
        </div>
        <div className="gaming-event-desc">{event.desc}</div>
      </div>
      {isLive ? (
        <span className="gaming-event-badge badge-live-now">Direkte nå</span>
      ) : isSoon ? (
        <span className="gaming-event-badge badge-soon">Snart</span>
      ) : !isPast ? (
        <span className="gaming-event-badge badge-upcoming">Kommende</span>
      ) : null}
    </a>
  );
}

