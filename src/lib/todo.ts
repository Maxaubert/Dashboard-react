import type { Priority } from '@/api/types';

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'Høy',
  medium: 'Medium',
  low: 'Lav',
};

export function isoToDisplay(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y.slice(-2)}`;
}

export function displayToIso(text: string): string | null {
  const m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{1,4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  let yyyy = Number(m[3]);
  if (m[3].length === 2) yyyy = 2000 + yyyy;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const date = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (
    date.getUTCFullYear() !== yyyy ||
    date.getUTCMonth() !== mm - 1 ||
    date.getUTCDate() !== dd
  ) {
    return null;
  }
  const mmStr = String(mm).padStart(2, '0');
  const ddStr = String(dd).padStart(2, '0');
  return `${yyyy}-${mmStr}-${ddStr}`;
}

export function formatDeadline(iso: string): { label: string; overdue: boolean } {
  const due = new Date(iso);
  const now = new Date();
  const diffDays = Math.round((due.getTime() - now.getTime()) / 86_400_000);
  const overdue = diffDays < 0;
  let label: string;
  if (diffDays === 0) label = 'I dag';
  else if (diffDays === 1) label = 'I morgen';
  else if (diffDays === -1) label = 'I går';
  else if (diffDays < 0) label = `${Math.abs(diffDays)} dager forsinket`;
  else if (diffDays < 7) label = `Om ${diffDays} dager`;
  else label = due.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
  return { label, overdue };
}
