import { useEffect, useState, type ReactNode } from 'react';
import { useHome } from '@/hooks/useHome';
import type { SectionId } from '@/lib/home';
import { LinksBentoCard } from './LinksBentoCard';
import { WishlistBentoCard } from './WishlistBentoCard';
import { WeatherBentoCard } from './WeatherBentoCard';
import { PlanBentoCard } from './PlanBentoCard';
import { TodoBentoCard } from './TodoBentoCard';
import { NewsBentoCard } from './NewsBentoCard';
import { PromptLauncher } from '@/components/launcher/PromptLauncher';
import '@/styles/bento.css';

/**
 * Bento home — dark "bento grid" dashboard. A fixed grid (no DnD reorder)
 * that respects the user's hidden-section list from Settings.
 *
 * The dark canvas is set on `body.bento-active`: we toggle that class for
 * the lifetime of this component so the layered `@layer base` rule in
 * globals.css overrides the otherwise-forced light paper background.
 */
export function HomeBento({ topActions }: { topActions?: ReactNode }) {
  const { data: home } = useHome();
  const hidden = (home?.hidden ?? []) as SectionId[];
  const show = (id: SectionId) => !hidden.includes(id);

  const [clock, setClock] = useState(() => fmtClock(new Date()));

  // Dark background lives on the body so it covers the full viewport,
  // beyond this element's box. Toggle on mount, restore on unmount.
  useEffect(() => {
    document.body.classList.add('bento-active');
    return () => document.body.classList.remove('bento-active');
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setClock(fmtClock(new Date())), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="bento-home">
      <div className="bento-top">
        <h1>Dashboard</h1>
        <div className="bento-top-right">
          <div className="bento-clock">
            <b>{clock}</b>
          </div>
          {topActions && <div className="bento-actions">{topActions}</div>}
        </div>
      </div>

      {show('prompt-launcher') && (
        <div className="bento-launcher">
          <PromptLauncher />
        </div>
      )}

      <div className="bento">
        {show('ext-lenker') && <LinksBentoCard />}
        {show('wishlist') && <WishlistBentoCard />}
        {show('vaer') && <WeatherBentoCard />}
        {show('dagens-plan') && <PlanBentoCard />}
        {show('todo') && <TodoBentoCard />}
        {show('nyhetssaker') && <NewsBentoCard />}
      </div>
    </div>
  );
}

function fmtClock(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
