import { useMemo } from 'react';
import { usePlan } from '@/hooks/usePlan';
import { usePageOverlay } from '@/context/PageOverlayContext';
import type { PlanItem } from '@/api/types';

/** Dagens plan — today's scheduled events. */
export function PlanBentoCard() {
  const { openOverlay } = usePageOverlay();
  const { data: plan } = usePlan();

  const now = new Date();
  const todayDow = (now.getDay() + 6) % 7; // 0=Mon..6=Sun
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const todays = useMemo(() => {
    if (!plan) return [];
    return plan
      .filter((ev) => {
        if (ev.recurring) return ev.days?.includes(todayDow) ?? false;
        return ev.date === todayIso;
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [plan, todayDow, todayIso]);

  return (
    <section className="bento-card area-plan">
      <div className="ch">
        <h2>Dagens plan</h2>
        <button type="button" className="ch-link" onClick={() => openOverlay('plan')}>
          Vis alle
        </button>
      </div>
      <div className="plist">
        {todays.length === 0 ? (
          <div className="plan-empty">
            <button type="button" className="plan-add" onClick={() => openOverlay('plan')}>
              + Legg til
            </button>
          </div>
        ) : (
          todays.map((ev) => (
            <PlanRow key={ev.id} event={ev} nowMin={nowMin} onOpen={() => openOverlay('plan')} />
          ))
        )}
      </div>
    </section>
  );
}

function PlanRow({ event, nowMin, onOpen }: { event: PlanItem; nowMin: number; onOpen: () => void }) {
  const parseMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const start = parseMin(event.startTime);
  const end = parseMin(event.endTime);
  const past = end < nowMin;
  const active = start <= nowMin && nowMin < end;

  return (
    <button type="button" className={`prow${past ? ' past' : ''}`} onClick={onOpen}>
      <span className="pdot" style={{ background: event.color || '#888' }} />
      <span className="ptime">
        {event.startTime}–{event.endTime}
      </span>
      <span className="ptitle">{event.title}</span>
      {event.location && <span className="ploc">{event.location}</span>}
      {active && <span className="pnow">Nå</span>}
    </button>
  );
}
