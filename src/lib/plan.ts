import type { PlanItem } from '@/api/types';

export const HOUR_HEIGHT = 58;
export const START_HOUR = 6;
export const END_HOUR = 23;
export const DAY_NAMES_SHORT = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'] as const;
const MONTH_NAMES = [
  'jan', 'feb', 'mar', 'apr', 'mai', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'des',
] as const;
export const COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f97316',
  '#10b981', '#06b6d4', '#f59e0b', '#ef4444',
] as const;

export interface LayoutedEvent extends PlanItem {
  _col: number;
  _cols: number;
}

export function parseTime(t?: string): number {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function timeToPx(t: string): number {
  return ((parseTime(t) - START_HOUR * 60) / 60) * HOUR_HEIGHT;
}

export function durationPx(start: string, end: string): number {
  const dur = Math.max(parseTime(end) - parseTime(start), 20);
  return (dur / 60) * HOUR_HEIGHT;
}

export function pxToTime(px: number): string {
  const totalMins = Math.round((px / HOUR_HEIGHT) * 60) + START_HOUR * 60;
  const snapped = Math.round(totalMins / 15) * 15;
  const clamped = Math.max(START_HOUR * 60, Math.min((END_HOUR - 1) * 60, snapped));
  const h = String(Math.floor(clamped / 60)).padStart(2, '0');
  const m = String(clamped % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export function addMinutes(timeStr: string, mins: number): string {
  const total = Math.min(END_HOUR * 60, parseTime(timeStr) + mins);
  const h = String(Math.floor(total / 60)).padStart(2, '0');
  const m = String(total % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export function getMondayOfWeek(offset: number): Date {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - dow + offset * 7);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatWeekTitle(mon: Date): string {
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  if (mon.getMonth() === sun.getMonth()) {
    return `${mon.getDate()}–${sun.getDate()}. ${MONTH_NAMES[mon.getMonth()]} ${mon.getFullYear()}`;
  }
  return `${mon.getDate()}. ${MONTH_NAMES[mon.getMonth()]} – ${sun.getDate()}. ${MONTH_NAMES[sun.getMonth()]} ${sun.getFullYear()}`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function layoutDayEvents(evts: PlanItem[]): LayoutedEvent[] {
  const sorted: LayoutedEvent[] = [...evts]
    .sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime))
    .map((e) => ({ ...e, _col: 0, _cols: 1 }));
  const columns: LayoutedEvent[][] = [];
  for (const ev of sorted) {
    const start = parseTime(ev.startTime);
    let placed = false;
    for (let c = 0; c < columns.length; c++) {
      const last = columns[c][columns[c].length - 1];
      if (parseTime(last.endTime) <= start) {
        columns[c].push(ev);
        ev._col = c;
        placed = true;
        break;
      }
    }
    if (!placed) {
      ev._col = columns.length;
      columns.push([ev]);
    }
  }
  for (const ev of sorted) {
    const s = parseTime(ev.startTime);
    const e = parseTime(ev.endTime);
    let maxCol = ev._col;
    for (const other of sorted) {
      if (parseTime(other.startTime) < e && parseTime(other.endTime) > s) {
        maxCol = Math.max(maxCol, other._col);
      }
    }
    ev._cols = maxCol + 1;
  }
  return sorted;
}

export function snapTo5(mins: number): string {
  const snapped = Math.round(mins / 5) * 5;
  const clamped = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, snapped));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}
