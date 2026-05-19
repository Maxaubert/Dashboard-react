import { useState } from 'react';
import { type PomodoroTimer } from '@/context/TimerContext';
import { formatHMS } from '@/lib/timerUtils';
import { WidgetShell } from '../WidgetShell';
import { TimerEditDialog } from './TimerEditDialog';

interface PomodoroWidgetProps {
  timer: PomodoroTimer;
  onClick: () => void;
  onRemove: () => void;
  onColorChange: (color: string) => void;
}

const LABELS = { focus: 'FOCUS', pause: 'BREAK' } as const;

export function PomodoroWidget({ timer, onClick, onRemove, onColorChange }: PomodoroWidgetProps) {
  const [editOpen, setEditOpen] = useState(false);
  const color = timer.phase === 'pause' ? '#06b6d4' : timer.color;
  // Shrink metaphor: current segment starts full and drains as time runs out,
  // completed sessions are empty (drained), future are full (still ahead).
  const segProgress = timer.totalMs > 0 ? timer.remainingMs / timer.totalMs : 0;
  // Hard cap at 12 as a safety net (reducer already clamps).
  const total = Math.min(Math.max(1, timer.settings.targetCycles | 0), 12);

  return (
    <>
      <WidgetShell
        onClick={onClick}
        ariaLabel="Open pomodoro timer"
        menu={[
          { label: 'Edit', onSelect: () => setEditOpen(true) },
          { label: 'Remove', onSelect: onRemove, destructive: true },
        ]}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.10em', fontWeight: 700 }}>
            {LABELS[timer.phase]}
          </span>
          <span style={{ color: 'rgba(255, 255, 255, 0.3)', fontSize: '0.65rem', marginLeft: 'auto' }}>
            {timer.cycle + (timer.phase === 'focus' ? 1 : 0)}/{total}
          </span>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#fff', fontSize: '1.85rem', fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '-1px' }}>
            {formatHMS(timer.remainingMs / 1000)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          {Array.from({ length: total }, (_, i) => {
            // Shrink metaphor: completed sessions drained to 0, future sessions full at 1,
            // current focus session shrinks from 1 → 0.
            let fill: number;
            if (i < timer.cycle) fill = 0;
            else if (i === timer.cycle && timer.phase === 'focus') fill = segProgress;
            else fill = 1;
            return (
              <div key={i} style={{ flex: 1, height: 3, background: 'rgba(255, 255, 255, 0.04)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${fill * 100}%`, height: '100%', background: color, borderRadius: 2 }} />
              </div>
            );
          })}
        </div>
      </WidgetShell>
      <TimerEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initialColor={timer.color}
        title="Edit pomodoro"
        onSave={onColorChange}
      />
    </>
  );
}
