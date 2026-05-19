import { useState } from 'react';
import { Timer } from 'lucide-react';
import { type CountdownTimer } from '@/context/TimerContext';
import { formatHMS } from '@/lib/timerUtils';
import { WidgetShell } from '../WidgetShell';
import { TimerEditDialog } from './TimerEditDialog';

interface CountdownWidgetProps {
  timer: CountdownTimer;
  onClick: () => void;
  onRemove: () => void;
  onColorChange: (color: string) => void;
}

export function CountdownWidget({ timer, onClick, onRemove, onColorChange }: CountdownWidgetProps) {
  const [editOpen, setEditOpen] = useState(false);
  const progress = timer.totalMs > 0 ? timer.remainingMs / timer.totalMs : 0;

  return (
    <>
      <WidgetShell
        onClick={onClick}
        ariaLabel="Open countdown timer"
        menu={[
          { label: 'Edit', onSelect: () => setEditOpen(true) },
          { label: 'Remove', onSelect: onRemove, destructive: true },
        ]}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Timer size={12} color={timer.color} />
          <span style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.78rem', fontWeight: 700 }}>
            Timer
          </span>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#fff', fontSize: '1.85rem', fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '-1px' }}>
            {formatHMS(timer.remainingMs / 1000)}
          </div>
        </div>
        {/* Bar drains right-to-left: anchored to the right, left edge moves
            rightward as progress decreases. */}
        <div style={{ height: 3, background: 'rgba(255, 255, 255, 0.04)', borderRadius: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: `${progress * 100}%`, height: '100%', background: timer.color, borderRadius: 2 }} />
        </div>
      </WidgetShell>
      <TimerEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initialColor={timer.color}
        title="Edit timer"
        onSave={onColorChange}
      />
    </>
  );
}
