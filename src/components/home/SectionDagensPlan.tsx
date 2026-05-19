import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePlan } from '@/hooks/usePlan';
import type { PlanItem } from '@/api/types';
import { cn } from '@/lib/cn';
import { DAY_NO, MON_NO } from '@/lib/home';
import { GripHandle, type HandleProps } from '@/components/home/GripHandle';

export function DagensPlanSection({ handleProps }: { handleProps?: HandleProps }) {
  const { data: plan } = usePlan();

  const now = new Date();
  const todayDow = (now.getDay() + 6) % 7; // 0=Mon..6=Sun
  // Local-time ISO (YYYY-MM-DD) — toISOString() would return UTC, which
  // is off-by-one for events dated "today" near local midnight.
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const dateLabel = `${DAY_NO[todayDow]} ${now.getDate()}. ${MON_NO[now.getMonth()]}`;

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
    <section>
      <div className="section-header">
        <span>
          <GripHandle handleProps={handleProps} />
          Dagens plan
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
          {dateLabel}
        </span>
      </div>
      <div className="today-list">
        {todays.length === 0 ? (
          <div className="today-empty">Ingen hendelser i dag.</div>
        ) : (
          todays.map((ev) => <TodayItem key={ev.id} event={ev} nowMin={nowMin} />)
        )}
      </div>
    </section>
  );
}

function TodayItem({ event, nowMin }: { event: PlanItem; nowMin: number }) {
  const parseMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const start = parseMin(event.startTime);
  const end = parseMin(event.endTime);
  const past = end < nowMin;
  const active = start <= nowMin && nowMin < end;

  return (
    <div className={cn('today-item', past && 'past')}>
      <Link to="/plan" className="today-item-inner">
        <div className="today-dot" style={{ background: event.color || '#888' }} />
        <span className="today-time">
          {event.startTime}–{event.endTime}
        </span>
        <span className="today-title">{event.title}</span>
        {event.location && <span className="today-loc">{event.location}</span>}
        {active && <span className="today-now-badge">Nå</span>}
      </Link>
    </div>
  );
}
