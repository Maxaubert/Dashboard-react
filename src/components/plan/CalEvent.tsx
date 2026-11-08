import { useRef } from 'react';
import { cn } from '@/lib/cn';
import {
  COLORS,
  END_HOUR,
  HOUR_HEIGHT,
  START_HOUR,
  durationPx,
  hexToRgba,
  parseTime,
  snapTo5,
  timeToPx,
  type LayoutedEvent,
} from '@/lib/plan';

export interface CalEventProps {
  event: LayoutedEvent;
  onEdit: () => void;
  onResizeOrMove: (startTime: string, endTime: string) => void;
}

export function CalEvent({ event: ev, onEdit, onResizeOrMove }: CalEventProps) {
  const ref = useRef<HTMLDivElement>(null);
  const top = timeToPx(ev.startTime);
  const height = Math.max(durationPx(ev.startTime, ev.endTime), 22);
  const color = ev.color || COLORS[0];
  const leftPct = (ev._col / ev._cols) * 100;
  const widthPct = (1 / ev._cols) * 100 - 1.5;

  function startResize(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const el = ref.current;
    if (!el) return;
    const startY = e.clientY;
    const origH = el.offsetHeight;
    const origStartMins = parseTime(ev.startTime);
    el.classList.add('resizing');

    const onMove = (me: MouseEvent) => {
      const dy = me.clientY - startY;
      const newH = Math.max(10, origH + dy);
      const rawEnd = origStartMins + (newH / HOUR_HEIGHT) * 60;
      const newEnd = snapTo5(Math.max(origStartMins + 5, rawEnd));
      el.style.height = `${durationPx(ev.startTime, newEnd)}px`;
      const timeEl = el.querySelector('.cal-event-time');
      if (timeEl) timeEl.textContent = `${ev.startTime}–${newEnd}`;
    };
    const onUp = (ue: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      el.classList.remove('resizing');
      const dy = ue.clientY - startY;
      const newH = Math.max(10, origH + dy);
      const rawEnd = origStartMins + (newH / HOUR_HEIGHT) * 60;
      const newEnd = snapTo5(Math.max(origStartMins + 5, rawEnd));
      onResizeOrMove(ev.startTime, newEnd);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function startMove(e: React.MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('cal-resize-handle')) return;
    if (e.button !== 0) return;
    const el = ref.current;
    if (!el) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const origTop = el.offsetTop;
    const origStartMins = parseTime(ev.startTime);
    const durMins = parseTime(ev.endTime) - origStartMins;
    let moved = false;

    const onMove = (me: MouseEvent) => {
      const dy = me.clientY - startY;
      const dx = me.clientX - startX;
      if (!moved && Math.abs(dy) < 4 && Math.abs(dx) < 4) return;
      moved = true;
      el.classList.add('dragging-move');
      const rawStart = START_HOUR * 60 + ((origTop + dy) / HOUR_HEIGHT) * 60;
      const clamped = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - durMins, rawStart));
      const newStart = snapTo5(clamped);
      const newEnd = snapTo5(parseTime(newStart) + durMins);
      el.style.top = `${timeToPx(newStart)}px`;
      const timeEl = el.querySelector('.cal-event-time');
      if (timeEl) timeEl.textContent = `${newStart}–${newEnd}`;
    };
    const onUp = (ue: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      el.classList.remove('dragging-move');
      if (!moved) {
        onEdit();
        return;
      }
      const dy = ue.clientY - startY;
      const rawStart = START_HOUR * 60 + ((origTop + dy) / HOUR_HEIGHT) * 60;
      const clamped = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - durMins, rawStart));
      const newStart = snapTo5(clamped);
      const newEnd = snapTo5(parseTime(newStart) + durMins);
      onResizeOrMove(newStart, newEnd);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  return (
    <div
      ref={ref}
      className={cn(
        'cal-event',
        height < 36 && 'cal-event-short',
        height >= 36 && height < 54 && 'cal-event-medium',
      )}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        background: hexToRgba(color, 0.18),
        borderLeftColor: color,
        color,
      }}
      onMouseDown={startMove}
    >
      <div className="cal-event-inner">
        <div className="cal-event-title">{ev.title}</div>
        <div className="cal-event-time">
          {ev.startTime}–{ev.endTime}
        </div>
        {ev.location && height >= 48 && <div className="cal-event-loc">📍 {ev.location}</div>}
      </div>
      {ev.recurring && <span className="cal-event-recur">↻</span>}
      <div className="cal-resize-handle" onMouseDown={startResize} />
    </div>
  );
}
