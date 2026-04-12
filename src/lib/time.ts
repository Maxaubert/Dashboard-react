/**
 * Date/time helpers. All formatting in Norwegian to match the existing UI.
 */

const NB = 'nb-NO';

const WEEKDAY_LONG = new Intl.DateTimeFormat(NB, { weekday: 'long' });
const DATE_SHORT = new Intl.DateTimeFormat(NB, {
  day: 'numeric',
  month: 'short',
});
const DATE_MEDIUM = new Intl.DateTimeFormat(NB, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const TIME = new Intl.DateTimeFormat(NB, {
  hour: '2-digit',
  minute: '2-digit',
});

export function formatWeekday(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return WEEKDAY_LONG.format(d);
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return DATE_SHORT.format(d);
}

export function formatDateMedium(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return DATE_MEDIUM.format(d);
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return TIME.format(d);
}

/**
 * Returns a relative time string like "om 3 dager", "i morgen", "i går",
 * "for 2 timer siden". Used by todo deadlines, assignment due dates, etc.
 */
export function formatRelative(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = Date.now();
  const diffMs = d.getTime() - now;
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  const rtf = new Intl.RelativeTimeFormat(NB, { numeric: 'auto' });

  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, 'second');
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, 'hour');
  if (Math.abs(diffDay) < 30) return rtf.format(diffDay, 'day');
  return formatDateMedium(d);
}

export function isPast(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getTime() < Date.now();
}

export function isToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
