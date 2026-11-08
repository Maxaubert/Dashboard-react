import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { WishlistGame } from '@/api/types';
import { buildLineChartSvg, fetchItadHistory, type HistoryPoint } from '@/lib/itadHistory';
import { GamePriceSummary, GamePriceTags } from './GamePrice';

export function GameModal({ game, onClose }: { game: WishlistGame; onClose: () => void }) {
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
            /* quota exceeded – ignore */
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
              src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/library_hero.jpg`}
              alt={game.name}
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                if (game.imgUrl && img.src !== game.imgUrl) img.src = game.imgUrl;
                else if (game.imgFallback && img.src !== game.imgFallback) img.src = game.imgFallback;
                else img.style.display = 'none';
              }}
            />
            <div className="gaming-modal-hero-gradient" />
          </div>
          <div className="gaming-modal-body">
            <Dialog.Title className="gaming-modal-name">{game.name}</Dialog.Title>
            <Dialog.Description className="sr-only">{game.name}</Dialog.Description>
            <div className="gaming-modal-price-row">
              <GamePriceSummary game={game} />
            </div>
            <GamePriceTags game={game} className="gaming-modal-ptags" />
            <div className="gaming-modal-chart-label">Prishistorikk – Steam</div>
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
