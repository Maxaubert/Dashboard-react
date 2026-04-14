// src/components/widgets/timers/AlarmWidget.tsx
import { useState } from 'react';
import { BellRing } from 'lucide-react';
import { type AlarmTimer } from '@/context/TimerContext';
import { WidgetShell } from '../WidgetShell';
import { TimerEditDialog } from './TimerEditDialog';

interface AlarmWidgetProps {
  timer: AlarmTimer;
  onClick: () => void;
  onRemove: () => void;
  onColorChange: (color: string) => void;
}

export function AlarmWidget({ timer, onClick, onRemove, onColorChange }: AlarmWidgetProps) {
  const [editOpen, setEditOpen] = useState(false);

  const armed = timer.running;
  const ringing = timer.ringing;
  const dim = !armed && !ringing;

  // Ringing: orange border glow on the shell.
  // Armed: opaque shell background so the rainbow gradient on the wrapper
  // shows only at the 2px padding ring around the shell.
  const shellStyle: React.CSSProperties = ringing
    ? {
        borderColor: 'rgba(249,115,22,0.5)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.018), 0 0 12px rgba(249,115,22,0.3)',
      }
    : armed
    ? { background: '#0a0a0a' }
    : {};

  const shell = (
    <WidgetShell
      onClick={onClick}
      ariaLabel="Open alarm"
      style={shellStyle}
      menu={[
        { label: 'Edit', onSelect: () => setEditOpen(true) },
        { label: 'Remove', onSelect: onRemove, destructive: true },
      ]}
    >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BellRing size={12} color={dim ? 'rgba(255,255,255,0.25)' : timer.color} />
          <span
            style={{
              color: ringing ? timer.color : dim ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)',
              fontSize: '0.78rem',
              fontWeight: 700,
            }}
          >
            {ringing ? 'Ringing' : 'Alarm'}
          </span>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              color: ringing ? timer.color : dim ? 'rgba(255,255,255,0.22)' : '#fff',
              fontSize: '1.85rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '-1px',
            }}
          >
            {timer.targetTime}
          </div>
        </div>
      </WidgetShell>
  );

  return (
    <>
      {armed && !ringing ? <div className="db-armed-alarm-wrap">{shell}</div> : shell}
      <TimerEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initialColor={timer.color}
        title="Edit alarm"
        onSave={onColorChange}
      />
    </>
  );
}
