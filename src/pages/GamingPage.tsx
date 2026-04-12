import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useWishlist } from '@/hooks/useWishlist';
import type { WishlistGame } from '@/api/types';
import { GAMING_EVENTS, type GamingEvent } from '@/data/gamingEvents';
import { buildLineChartSvg, fetchItadHistory, type HistoryPoint } from '@/lib/itadHistory';
import { cn } from '@/lib/cn';

type Tab = 'wishlist' | 'events';

const PTAG_LABEL: Record<string, { cls: string; label: string }> = {
  hot: { cls: 'ptag-hot', label: '🔥 Hot' },
  'rarely-on-sale': { cls: 'ptag-rare', label: '🔥 Rarely on Sale' },
};

function ptagsArr(g: WishlistGame): string[] {
  if (Array.isArray(g.priceTag)) return g.priceTag;
  if (g.priceTag) return [g.priceTag as string];
  return [];
}

export function GamingPage() {
  const { data: games, isLoading, error } = useWishlist();
  const [tab, setTab] = useState<Tab>('wishlist');
  const [activeGame, setActiveGame] = useState<WishlistGame | null>(null);

  const onSale = useMemo(
    () => (games ?? []).filter((g) => g.onSale).sort((a, b) => b.discount - a.discount),
    [games]
  );
  const regular = useMemo(() => (games ?? []).filter((g) => !g.onSale), [games]);

  return (
    <div className="gaming-page">
      <div className="page-header">
        <div className="page-header-eyebrow">Gaming</div>
        <div className="page-header-title">Steam ønskeliste</div>
        <div className="page-header-sub">
          {games ? `${games.length} spill · ${onSale.length} på salg nå` : 'Laster…'}
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
        {tab === 'wishlist' && games && (
          <span className="gaming-filter-count">{games.length} spill</span>
        )}
      </div>

      {tab === 'wishlist' ? (
        error ? (
          <div className="gaming-state-box">Kunne ikke laste ønskeliste.</div>
        ) : isLoading ? (
          <div className="gaming-state-box">Laster ønskeliste…</div>
        ) : !games || games.length === 0 ? (
          <div className="gaming-state-box">Ønskelisten er tom.</div>
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

/* ── Game detail modal ──────────────────────────────────────────────────── */
function GameModal({ game, onClose }: { game: WishlistGame; onClose: () => void }) {
  const tags = ptagsArr(game);
  const [chartSvg, setChartSvg] = useState<string | null>(null);
  const [chartState, setChartState] = useState<'loading' | 'empty' | 'ok'>(
    game.itadId ? 'loading' : 'empty'
  );

  useEffect(() => {
    if (!game.itadId) {
      setChartState('empty');
      return;
    }
    const cacheKey = `itad_hist_${game.itadId}`;
    // Show cached version instantly
    let cached: HistoryPoint[] | null = null;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) cached = JSON.parse(raw);
    } catch {
      /* ignore */
    }
    if (cached && cached.length >= 2) {
      setChartSvg(buildLineChartSvg(cached));
      setChartState('ok');
    }

    let cancelled = false;
    fetchItadHistory(game.itadId)
      .then((pts) => {
        if (cancelled) return;
        if (pts.length >= 2) {
          setChartSvg(buildLineChartSvg(pts));
          setChartState('ok');
          try {
            localStorage.setItem(cacheKey, JSON.stringify(pts));
          } catch {
            /* quota exceeded — ignore */
          }
        } else if (!cached) {
          setChartState('empty');
        }
      })
      .catch(() => {
        if (!cached && !cancelled) setChartState('empty');
      });

    return () => {
      cancelled = true;
    };
  }, [game.itadId]);

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="gaming-modal-overlay" />
        <Dialog.Content className="gaming-modal-panel">
          <Dialog.Close asChild>
            <button className="gaming-modal-close" aria-label="Lukk">✕</button>
          </Dialog.Close>
          <div className="gaming-modal-hero">
            <img
              src={game.imgUrl}
              alt={game.name}
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                if (game.imgFallback && img.src !== game.imgFallback) img.src = game.imgFallback;
                else img.style.display = 'none';
              }}
            />
            <div className="gaming-modal-hero-gradient" />
          </div>
          <div className="gaming-modal-body">
            <Dialog.Title className="gaming-modal-name">{game.name}</Dialog.Title>
            <Dialog.Description className="sr-only">{game.name}</Dialog.Description>
            <div className="gaming-modal-price-row">
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
            {tags.length > 0 && (
              <div className="gaming-modal-ptags">
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
            <div className="gaming-modal-chart-label">Prishistorikk — Steam</div>
            {chartState === 'loading' ? (
              <div className="gaming-modal-chart-loading">
                <span className="chart-spinner" />
                Laster prishistorikk…
              </div>
            ) : chartState === 'empty' ? (
              <div className="gaming-modal-chart-empty">Ingen prisdata</div>
            ) : chartSvg ? (
              <div className="gaming-modal-chart" dangerouslySetInnerHTML={{ __html: chartSvg }} />
            ) : null}
            <a
              href={game.storeUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="gaming-modal-steam-btn"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Åpne i Steam Store
            </a>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
