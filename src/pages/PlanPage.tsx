import { useEffect, useMemo, useRef, useState } from 'react';
import { usePlan, useSavePlan } from '@/hooks/usePlan';
import { useToast } from '@/components/ui';
import { CalEvent } from '@/components/plan/CalEvent';
import { PlanModal } from '@/components/plan/PlanModal';
import type { PlanItem } from '@/api/types';
import { cn } from '@/lib/cn';
import {
  COLORS,
  DAY_NAMES_SHORT,
  END_HOUR,
  HOUR_HEIGHT,
  START_HOUR,
  addMinutes,
  formatWeekTitle,
  getMondayOfWeek,
  isSameDay,
  isoDate,
  layoutDayEvents,
  pxToTime,
  timeToPx,
} from '@/lib/plan';

export function PlanPage() {
  const { data: items = [] } = usePlan();
  const savePlan = useSavePlan();
  const { toast } = useToast();

  const [weekOffset, setWeekOffset] = useState(0);
  const [modalItem, setModalItem] = useState<PlanItem | null>(null);
  const [modalIsEdit, setModalIsEdit] = useState(false);

  const calBodyRef = useRef<HTMLDivElement>(null);
  const didInitialScrollRef = useRef(false);

  const monday = useMemo(() => getMondayOfWeek(weekOffset), [weekOffset]);
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const totalHours = END_HOUR - START_HOUR;
  const totalHeight = totalHours * HOUR_HEIGHT;

  useEffect(() => {
    if (didInitialScrollRef.current) return;
    const body = calBodyRef.current;
    if (!body) return;
    didInitialScrollRef.current = true;
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const px = ((mins - START_HOUR * 60) / 60) * HOUR_HEIGHT;
    body.scrollTop = Math.max(0, px - 120);
  }, []);

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  function persist(next: PlanItem[]) {
    savePlan.mutate(next, {
      onError: () => toast({ tone: 'danger', title: 'Klarte ikke å lagre' }),
    });
  }

  function openNewModal(dayIndex?: number, startTime?: string) {
    const now = new Date();
    const defaultDow = dayIndex !== undefined ? dayIndex : (now.getDay() + 6) % 7;
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + defaultDow);
    const start = startTime || '09:00';
    setModalIsEdit(false);
    setModalItem({
      id: String(Date.now()),
      title: '',
      startTime: start,
      endTime: addMinutes(start, 60),
      location: '',
      recurring: false,
      days: [defaultDow],
      date: isoDate(dayDate),
      color: COLORS[0],
    });
  }

  function openEditModal(ev: PlanItem) {
    setModalIsEdit(true);
    setModalItem({ ...ev });
  }

  function handleSave(item: PlanItem) {
    const idx = items.findIndex((x) => x.id === item.id);
    const next = idx >= 0 ? items.map((x, i) => (i === idx ? item : x)) : [...items, item];
    persist(next);
    setModalItem(null);
  }

  function handleDelete(id: string) {
    persist(items.filter((x) => x.id !== id));
    setModalItem(null);
  }

  const now = new Date();
  const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const nowTop = timeToPx(nowStr);
  const showNowLine = nowTop >= 0 && nowTop <= totalHeight;

  return (
    <div className="page plan-page">
      <div className="week-nav">
        <div className="week-nav-left">
          <button className="week-nav-btn" onClick={() => setWeekOffset((w) => w - 1)} title="Forrige uke">
            ‹
          </button>
          <button className="week-nav-btn" onClick={() => setWeekOffset((w) => w + 1)} title="Neste uke">
            ›
          </button>
          <button className="week-today-btn" onClick={() => setWeekOffset(0)}>
            I dag
          </button>
          <span className="week-title">{formatWeekTitle(monday)}</span>
        </div>
        <button className="week-add-btn" onClick={() => openNewModal()}>
          + Ny hendelse
        </button>
      </div>

      <div className="cal-outer">
        <div className="cal-day-headers">
          <div className="cal-gutter-head" />
          {Array.from({ length: 7 }, (_, d) => {
            const date = new Date(monday);
            date.setDate(monday.getDate() + d);
            const isToday = isSameDay(date, today);
            return (
              <div key={d} className={cn('cal-day-head', isToday && 'cal-today')}>
                <span className="cal-day-name">{DAY_NAMES_SHORT[d]}</span>
                <span className={cn('cal-day-num', isToday && 'today-num')}>{date.getDate()}</span>
              </div>
            );
          })}
        </div>

        <div className="cal-body" ref={calBodyRef}>
          <div className="cal-gutter" style={{ height: `${totalHeight}px` }}>
            {Array.from({ length: totalHours + 1 }, (_, i) => {
              const h = START_HOUR + i;
              const top = (h - START_HOUR) * HOUR_HEIGHT;
              return (
                <div key={h} className="cal-hour-label" style={{ top: `${top}px` }}>
                  {`${String(h).padStart(2, '0')}:00`}
                </div>
              );
            })}
          </div>

          <div className="cal-cols" style={{ height: `${totalHeight}px` }}>
            {Array.from({ length: 7 }, (_, d) => {
              const date = new Date(monday);
              date.setDate(monday.getDate() + d);
              const dateStr = isoDate(date);
              const isToday = isSameDay(date, today);
              const dayEvents = items.filter((ev) => {
                if (ev.recurring) return Array.isArray(ev.days) && ev.days.includes(d);
                return ev.date === dateStr;
              });
              const layouted = layoutDayEvents(dayEvents);

              return (
                <div
                  key={d}
                  className={cn('cal-col', isToday && 'cal-col-today')}
                  style={{ height: `${totalHeight}px` }}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('.cal-event')) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const relY = e.clientY - rect.top;
                    openNewModal(d, pxToTime(relY));
                  }}
                >
                  {Array.from({ length: totalHours }, (_, i) => {
                    const top = i * HOUR_HEIGHT;
                    return (
                      <div key={i}>
                        <div className="cal-hour-line" style={{ top: `${top}px` }} />
                        <div className="cal-half-line" style={{ top: `${top + HOUR_HEIGHT / 2}px` }} />
                      </div>
                    );
                  })}

                  {isToday && showNowLine && (
                    <div className="cal-now-line" style={{ top: `${nowTop}px` }}>
                      <div className="cal-now-dot" />
                    </div>
                  )}

                  {layouted.map((ev) => (
                    <CalEvent
                      key={ev.id}
                      event={ev}
                      onEdit={() => openEditModal(ev)}
                      onResizeOrMove={(nextStart, nextEnd) => {
                        persist(
                          items.map((x) =>
                            x.id === ev.id ? { ...x, startTime: nextStart, endTime: nextEnd } : x,
                          ),
                        );
                      }}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {modalItem && (
        <PlanModal
          item={modalItem}
          isEdit={modalIsEdit}
          onClose={() => setModalItem(null)}
          onSave={handleSave}
          onDelete={modalIsEdit ? () => handleDelete(modalItem.id) : undefined}
        />
      )}
    </div>
  );
}
