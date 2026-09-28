import { useState } from 'react';
import { Settings2, X } from 'lucide-react';
import { useTimers } from '@/context/TimerContext';
import { TimerSettingsDialog } from './TimerSettingsDialog';
import { TimerDisplay } from './TimerDisplay';
import { WIDGET_KINDS, type TimerKind } from './widgetKinds';
import '@/styles/widget-timers.css';

export function TimerWidget({ kind, onRemove }: { kind: TimerKind; onRemove: () => void }) {
  const timer = useTimers().getTimer(kind);
  const [editing, setEditing] = useState(false);
  const { title, icon: Icon } = WIDGET_KINDS[kind];
  const complete = (timer.kind === 'pomodoro' && timer.completed)
    || (timer.kind === 'countdown' && timer.remainingMs === 0 && timer.zeroedAt !== null)
    || (timer.kind === 'alarm' && timer.ringing);
  return (
    <article className="widget-tile widget-timer-tile" aria-label={title}>
      <div className="widget-heading">
        <Icon size={20} aria-hidden="true" />
        <h3><button className="widget-timer-title" onClick={() => setEditing(true)} title="Åpne stor timer">{title}</button></h3>
        {kind !== 'stopwatch' && <button className="widget-icon-button" aria-label={`Tilpass ${title.toLowerCase()}`}
          title={timer.running ? 'Sett timeren på pause for å tilpasse' : 'Tilpass'} disabled={timer.running || complete}
          onClick={() => setEditing(true)}><Settings2 size={18} /></button>}
        <button className="widget-icon-button" aria-label={`Fjern ${title} fra widgets`} onClick={onRemove}><X size={18} /></button>
      </div>
      <TimerDisplay kind={kind} />
      {editing && <TimerSettingsDialog kind={kind} onClose={() => setEditing(false)} />}
    </article>
  );
}
