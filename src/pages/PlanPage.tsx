import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { usePlan, useSavePlan } from '@/hooks/usePlan';
import type { PlanItem } from '@/api/types';
import { Modal, useToast } from '@/components/ui';
import { getHoliday } from '@/data/holidays';
import { cn } from '@/lib/cn';

/* ── Constants (mirror legacy plan.html) ────────────────────────────────── */
const DAY_NAMES = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'] as const;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
const GRID_START = 7 * 60; //  07:00 in minutes
const GRID_END = 24 * 60; //   24:00 in minutes
const PX_PER_MIN = 80 / 60; // 80 px per hour
const COLOR_PRESETS = [
  '#60a5fa', '#34d399', '#a78bfa', '#fb923c',
  '#f472b6', '#2dd4bf', '#fbbf24', '#f87171',
];

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function timeToPx(t: string): number {
  return (parseTime(t) - GRID_START) * PX_PER_MIN;
}
function durationPx(start: string, end: string): number {
  return (parseTime(end) - parseTime(start)) * PX_PER_MIN;
}
function pxToTime(px: number): string {
  // Snap to whole hour: clicking inside 10:xx always becomes 10:00.
  const totalMin = Math.floor((px / PX_PER_MIN + GRID_START) / 60) * 60;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function addMinutes(t: string, mins: number): string {
  const total = parseTime(t) + mins;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
function getMondayOfWeek(offset = 0): Date {
  const today = new Date();
  const dow = (today.getDay() + 6) % 7; // Mon=0
  const monday = new Date(today);
  monday.setDate(today.getDate() - dow + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function formatWeekTitle(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  if (monday.getMonth() === sunday.getMonth()) {
    return `${monday.getDate()}. – ${sunday.getDate()}. ${MONTHS[monday.getMonth()]} ${monday.getFullYear()}`;
  }
  return `${monday.getDate()}. ${MONTHS[monday.getMonth()]} – ${sunday.getDate()}. ${MONTHS[sunday.getMonth()]} ${monday.getFullYear()}`;
}
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ── Overlap layout — places concurrent events side-by-side ────────────── */
interface LaidOutEvent extends PlanItem {
  startMin: number;
  endMin: number;
  _col: number;
  _totalCols: number;
}

function layoutDayEvents(dayEvs: PlanItem[]): LaidOutEvent[] {
  const sorted: LaidOutEvent[] = dayEvs
    .map((ev) => ({
      ...ev,
      startMin: parseTime(ev.startTime),
      endMin: parseTime(ev.endTime),
      _col: 0,
      _totalCols: 1,
    }))
    .sort((a, b) => a.startMin - b.startMin);

  // Greedy column packing.
  const columns: LaidOutEvent[][] = [];
  for (const ev of sorted) {
    let placed = false;
    for (let i = 0; i < columns.length; i++) {
      const last = columns[i][columns[i].length - 1];
      if (last.endMin <= ev.startMin) {
        columns[i].push(ev);
        ev._col = i;
        placed = true;
        break;
      }
    }
    if (!placed) {
      ev._col = columns.length;
      columns.push([ev]);
    }
  }

  // Compute the max number of concurrent columns each event sees.
  for (const ev of sorted) {
    let maxCols = 0;
    for (const col of columns) {
      for (const e of col) {
        if (e.startMin < ev.endMin && e.endMin > ev.startMin) {
          maxCols = Math.max(maxCols, e._col + 1);
        }
      }
    }
    ev._totalCols = maxCols;
  }
  return sorted;
}

/* ── Page ───────────────────────────────────────────────────────────────── */
export function PlanPage() {
  const { data: planData } = usePlan();
  const savePlan = useSavePlan();
  const { toast } = useToast();

  const [weekOffset, setWeekOffset] = useState(0);
  const [editing, setEditing] = useState<PlanItem | null>(null);
  const [creating, setCreating] = useState<{ day?: number; date?: string; startTime?: string; endTime?: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // On first mount and on week change back to current, scroll the calendar
  // so 07:30 is roughly at the top of the visible area (gives room for 8am).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (weekOffset === 0 || el.scrollTop === 0) {
      el.scrollTop = 30 * PX_PER_MIN;
    }
  }, [weekOffset]);

  const events = planData ?? [];
  const monday = useMemo(() => getMondayOfWeek(weekOffset), [weekOffset]);
  const today = new Date();

  function persist(next: PlanItem[]) {
    savePlan.mutate(next, {
      onError: () => toast({ tone: 'danger', title: 'Klarte ikke å lagre' }),
    });
  }

  function handleSave(item: PlanItem) {
    const idx = events.findIndex((e) => e.id === item.id);
    let next: PlanItem[];
    if (idx >= 0) {
      next = [...events];
      next[idx] = item;
    } else {
      next = [...events, item];
    }
    persist(next);
    setEditing(null);
    setCreating(null);
  }

  function handleDelete(id: string) {
    persist(events.filter((e) => e.id !== id));
    setEditing(null);
  }

  function handleGridClick(e: ReactMouseEvent<HTMLDivElement>, dayIdx: number, dateStr: string) {
    // Ignore clicks on existing events.
    if ((e.target as HTMLElement).closest('.cal-event')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const start = pxToTime(Math.max(0, clickY));
    const end = addMinutes(start, 60);
    setCreating({ day: dayIdx, date: dateStr, startTime: start, endTime: end });
  }

  // Build the 7 day buckets for this week.
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, d) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + d);
      const dateStr = isoDate(date);
      const dayEvs = events.filter((ev) =>
        ev.recurring ? ev.days?.includes(d) ?? false : ev.date === dateStr
      );
      return {
        date,
        dateStr,
        isToday: isSameDay(date, today),
        holiday: getHoliday(dateStr),
        events: layoutDayEvents(dayEvs),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, monday]);

  // Hour labels for the time gutter (07:00..23:00)
  const hours = useMemo(() => {
    const arr: string[] = [];
    for (let h = GRID_START; h < GRID_END; h += 60) {
      arr.push(`${String(h / 60).padStart(2, '0')}:00`);
    }
    return arr;
  }, []);

  // Now-line top offset (only meaningful for today's column).
  const nowMin = today.getHours() * 60 + today.getMinutes();
  const nowTop =
    nowMin >= GRID_START && nowMin <= GRID_END ? (nowMin - GRID_START) * PX_PER_MIN : null;

  return (
    <>
      {/* Week toolbar */}
      <div className="week-toolbar">
        <button
          className="week-nav-btn"
          onClick={() => setWeekOffset((w) => w - 1)}
          aria-label="Forrige uke"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button className="week-nav-btn week-today-btn" onClick={() => setWeekOffset(0)}>
          I dag
        </button>
        <button
          className="week-nav-btn"
          onClick={() => setWeekOffset((w) => w + 1)}
          aria-label="Neste uke"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
        <span className="week-title">{formatWeekTitle(monday)}</span>
        <button className="week-add-btn" onClick={() => setCreating({})}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Legg til
        </button>
      </div>

      {/* Calendar */}
      <div className="cal-scroll" ref={scrollRef}>
        <div className="cal-wrap">
          {/* Header row — sticky */}
          <div className="cal-header">
            <div className="cal-header-spacer" />
            {days.map((day, i) => (
              <div
                key={i}
                className={cn(
                  'cal-day-header',
                  day.isToday && 'today',
                  day.holiday && 'holiday'
                )}
                title={day.holiday?.name}
              >
                <div className="day-name">{DAY_NAMES[i]}</div>
                <div className="day-num">{day.date.getDate()}</div>
                {day.holiday && (
                  <span className="day-holiday-label">{day.holiday.name}</span>
                )}
              </div>
            ))}
          </div>

          {/* Body — time gutter + 7 day columns */}
          <div className="cal-body">
            <div className="cal-time-col">
              {hours.map((h) => (
                <div key={h} className="cal-time-slot">
                  <span className="cal-time-label">{h}</span>
                </div>
              ))}
            </div>

            {days.map((day, d) => (
              <div
                key={d}
                className={cn(
                  'cal-day-col',
                  day.isToday && 'today-col',
                  day.holiday && 'holiday-col'
                )}
                onClick={(e) => handleGridClick(e, d, day.dateStr)}
              >
                {hours.map((h) => (
                  <div key={h} className="cal-hour-row" />
                ))}

                {/* Now line on today */}
                {day.isToday && nowTop !== null && (
                  <div className="cal-now-line" style={{ top: `${nowTop}px` }} />
                )}

                {/* Events */}
                {day.events.map((ev) => (
                  <CalEvent key={ev.id} event={ev} onClick={() => setEditing(ev)} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {(editing || creating) && (
        <PlanModal
          item={editing}
          defaults={creating ?? undefined}
          monday={monday}
          onClose={() => {
            setEditing(null);
            setCreating(null);
          }}
          onSave={handleSave}
          onDelete={editing ? () => handleDelete(editing.id) : undefined}
        />
      )}
    </>
  );
}

/* ── Calendar event ──────────────────────────────────────────────────────── */
function CalEvent({ event, onClick }: { event: LaidOutEvent; onClick: () => void }) {
  const top = timeToPx(event.startTime);
  const height = Math.max(durationPx(event.startTime, event.endTime), 24);
  const pctW = 100 / event._totalCols;
  const pctL = event._col * pctW;
  const color = event.color || '#60a5fa';

  return (
    <div
      className="cal-event"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: `calc(${pctL}% + 2px)`,
        width: `calc(${pctW}% - 4px)`,
        background: hexToRgba(color, 0.16),
        borderLeftColor: color,
        color,
      }}
    >
      {height >= 36 ? (
        <>
          <div className="ev-title">{event.title}</div>
          {event.tag && <div className="ev-sub">{event.tag}</div>}
        </>
      ) : (
        <div className="ev-title" style={{ fontSize: '0.65rem' }}>
          {event.title}
        </div>
      )}
      {height >= 68 && event.location && <div className="ev-loc">{event.location}</div>}
    </div>
  );
}

/* ── Add / edit modal ────────────────────────────────────────────────────── */
interface PlanModalProps {
  item: PlanItem | null;
  defaults?: { day?: number; date?: string; startTime?: string; endTime?: string };
  monday: Date;
  onClose: () => void;
  onSave: (item: PlanItem) => void;
  onDelete?: () => void;
}

function PlanModal({ item, defaults, monday, onClose, onSave, onDelete }: PlanModalProps) {
  const initialDate = useMemo(() => {
    if (item?.date) return item.date;
    if (defaults?.date) return defaults.date;
    return isoDate(monday);
  }, [item, defaults, monday]);

  const [form, setForm] = useState<PlanItem>(() => {
    if (item) return { ...item };
    return {
      id: `plan_${Date.now()}`,
      title: '',
      tag: '',
      recurring: defaults?.day === undefined ? true : false,
      days: defaults?.day !== undefined ? [defaults.day] : [],
      date: initialDate,
      startTime: defaults?.startTime ?? '08:15',
      endTime: defaults?.endTime ?? '10:00',
      location: '',
      color: COLOR_PRESETS[0],
    };
  });

  function update<K extends keyof PlanItem>(key: K, value: PlanItem[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleDay(d: number) {
    const days = form.days ?? [];
    update('days', days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort());
  }

  function setTimePart(field: 'startTime' | 'endTime', part: 'h' | 'm', value: string) {
    const [h, m] = form[field].split(':');
    const next = part === 'h' ? `${value}:${m}` : `${h}:${value}`;
    update(field, next);
  }

  function handleSubmit() {
    if (!form.title.trim()) return;
    if (form.recurring && (!form.days || form.days.length === 0)) return;
    if (!form.recurring && !form.date) return;
    onSave(form);
  }

  // Time-select option ranges (07-23 hours, 00-55 minutes by 5)
  const hourOptions = Array.from({ length: 17 }, (_, i) => String(i + 7).padStart(2, '0'));
  const minuteOptions = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

  const [startH, startM] = form.startTime.split(':');
  const [endH, endM] = form.endTime.split(':');

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={item ? 'Rediger hendelse' : 'Legg til hendelse'}
      size="md"
      footer={
        <>
          <button className="modal-btn-primary" onClick={handleSubmit}>
            {item ? 'Lagre' : 'Legg til'}
          </button>
          <button className="modal-btn-cancel" onClick={onClose}>
            Avbryt
          </button>
          {onDelete && (
            <button className="modal-btn-delete" onClick={onDelete}>
              Slett
            </button>
          )}
        </>
      }
    >
      <div className="modal-row">
        <label htmlFor="f-title">Tittel</label>
        <input
          id="f-title"
          type="text"
          placeholder="Hva skal du gjøre?"
          autoComplete="off"
          autoFocus
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
        />
      </div>

      <div className="modal-row">
        <label htmlFor="f-tag">
          Tag
          <span className="modal-label-hint">(valgfri kort tekst under tittel)</span>
        </label>
        <input
          id="f-tag"
          type="text"
          placeholder="F.eks. Eksamen, Lab 5, Lesing…"
          autoComplete="off"
          maxLength={40}
          value={form.tag ?? ''}
          onChange={(e) => update('tag', e.target.value)}
        />
      </div>

      <div className="modal-recurring-row">
        <input
          type="checkbox"
          id="f-recurring"
          checked={form.recurring}
          onChange={(e) => update('recurring', e.target.checked)}
        />
        <label htmlFor="f-recurring">Gjentas ukentlig</label>
      </div>

      {form.recurring ? (
        <div className="modal-row">
          <label>Dager</label>
          <div className="modal-day-row">
            {DAY_NAMES.map((label, i) => {
              const active = form.days?.includes(i) ?? false;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={cn('modal-day-btn', active && 'selected')}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="modal-row">
          <label htmlFor="f-date">Dato</label>
          <input
            id="f-date"
            type="date"
            value={form.date ?? ''}
            onChange={(e) => update('date', e.target.value)}
          />
        </div>
      )}

      <div className="modal-row-2col">
        <div>
          <label>Fra</label>
          <div className="time-sel-wrap">
            <select value={startH} onChange={(e) => setTimePart('startTime', 'h', e.target.value)}>
              {hourOptions.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <span className="time-colon">:</span>
            <select value={snapTo5(startM)} onChange={(e) => setTimePart('startTime', 'm', e.target.value)}>
              {minuteOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label>Til</label>
          <div className="time-sel-wrap">
            <select value={endH} onChange={(e) => setTimePart('endTime', 'h', e.target.value)}>
              {hourOptions.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <span className="time-colon">:</span>
            <select value={snapTo5(endM)} onChange={(e) => setTimePart('endTime', 'm', e.target.value)}>
              {minuteOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="modal-row">
        <label htmlFor="f-location">Sted</label>
        <input
          id="f-location"
          type="text"
          placeholder="F.eks. Sone A Aud Max"
          autoComplete="off"
          value={form.location ?? ''}
          onChange={(e) => update('location', e.target.value)}
        />
      </div>

      <div className="modal-row">
        <label>Farge</label>
        <div className="modal-color-row">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => update('color', c)}
              style={{ background: c }}
              className={cn('modal-color-swatch', form.color === c && 'selected')}
              aria-label={`Velg farge ${c}`}
            />
          ))}
          <div className="modal-color-custom">
            <label htmlFor="f-color-custom">Egendefinert</label>
            <input
              id="f-color-custom"
              type="color"
              value={form.color ?? '#60a5fa'}
              onChange={(e) => update('color', e.target.value)}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** Snap a minute string to the nearest 5 so it matches an option in the select. */
function snapTo5(m: string): string {
  const n = parseInt(m, 10) || 0;
  const snapped = Math.round(n / 5) * 5 % 60;
  return String(snapped).padStart(2, '0');
}
