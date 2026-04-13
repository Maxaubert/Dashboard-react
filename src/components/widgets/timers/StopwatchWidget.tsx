import { useState } from 'react';
import { type StopwatchTimer } from '@/context/TimerContext';
import { formatStopwatch } from '@/hooks/useTimer';
import { WidgetShell } from '../WidgetShell';
import { TimerEditDialog } from './TimerEditDialog';

interface StopwatchWidgetProps {
  timer: StopwatchTimer;
  onClick: () => void;
  onRemove: () => void;
  onColorChange: (color: string) => void;
}

export function StopwatchWidget({ timer, onClick, onRemove, onColorChange }: StopwatchWidgetProps) {
  const [editOpen, setEditOpen] = useState(false);
  const formatted = formatStopwatch(timer.elapsedMs);
  const dotIdx = formatted.lastIndexOf('.');
  const main = dotIdx >= 0 ? formatted.slice(0, dotIdx) : formatted;
  const cs = dotIdx >= 0 ? formatted.slice(dotIdx) : '';

  return (
    <>
      <WidgetShell
        onClick={onClick}
        ariaLabel="Open stopwatch"
        style={{ textAlign: 'center' }}
        menu={[
          { label: 'Edit', onSelect: () => setEditOpen(true) },
          { label: 'Remove', onSelect: onRemove, destructive: true },
        ]}
      >
        <div style={{ color: `${timer.color}b3`, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '2px', textAlign: 'left' }}>
          Stopwatch
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#fff', fontSize: '1.75rem', fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '-1px' }}>
            {main}<span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '1.2rem' }}>{cs}</span>
          </div>
        </div>
      </WidgetShell>
      <TimerEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initialColor={timer.color}
        title="Edit stopwatch"
        onSave={onColorChange}
      />
    </>
  );
}
