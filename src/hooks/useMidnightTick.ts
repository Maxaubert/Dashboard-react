import { useState, useEffect } from 'react';

/**
 * Returns today's ISO date (YYYY-MM-DD) and schedules a re-render at local
 * midnight so callers automatically update without needing a page reload.
 */
export function useMidnightTick(): string {
  const [today, setToday] = useState(() => todayISO());

  useEffect(() => {
    function scheduleNextTick() {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 100); // first instant of tomorrow + 100ms cushion
      const msUntilMidnight = midnight.getTime() - now.getTime();
      return window.setTimeout(() => {
        setToday(todayISO());
        handle = scheduleNextTick();
      }, msUntilMidnight);
    }

    let handle = scheduleNextTick();
    return () => window.clearTimeout(handle);
  }, []);

  return today;
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
