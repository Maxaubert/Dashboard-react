import { useState } from 'react';
import { Pause, Play, RotateCcw, Settings2, X } from 'lucide-react';
import { useTimers } from '@/context/TimerContext';
import { TimerSettingsDialog } from './TimerSettingsDialog';
import { WIDGET_KINDS, type TimerKind } from './widgetKinds';

function duration(ms: number, roundUp = true) {
  const seconds = Math.max(0, roundUp ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const remainder = seconds % 60;
  return `${hours ? `${hours}:` : ''}${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function TimerWidget({ kind, onRemove }: { kind: TimerKind; onRemove: () => void }) {
  const timers = useTimers();
  const timer = timers.getTimer(kind);
  const [editing, setEditing] = useState(false);
  const { title, icon: Icon } = WIDGET_KINDS[kind];
  const value = timer.kind === 'alarm' ? timer.targetTime : timer.kind === 'stopwatch' ? duration(timer.elapsedMs, false) : duration(timer.remainingMs);
  const complete = (timer.kind === 'pomodoro' && timer.completed) || (timer.kind === 'countdown' && timer.remainingMs === 0) || (timer.kind === 'alarm' && timer.ringing);
  const subtitle = timer.kind === 'pomodoro' ? `${timer.phase === 'focus' ? 'Fokus' : 'Pause'} · Økt ${Math.min(timer.cycle + 1, timer.settings.targetCycles)} av ${timer.settings.targetCycles}`
    : timer.kind === 'alarm' ? (timer.running && timer.fireAt ? `Ringer ${new Date(timer.fireAt).toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })}` : 'Velg tid og aktiver alarmen')
    : timer.running ? 'Pågår' : timer.kind === 'stopwatch' && timer.elapsedMs === 0 ? 'Klar når du er' : 'Klar til å fortsette';

  function reset() {
    if (kind === 'countdown') timers.resetCountdown();
    if (kind === 'pomodoro') timers.resetPomodoro();
    if (kind === 'stopwatch') timers.resetStopwatch();
    if (kind === 'alarm') timers.stopAlarm();
  }
  function toggle() {
    if (kind === 'countdown') timers.setCountdownRunning(!timer.running);
    if (kind === 'pomodoro') timers.setPomodoroRunning(!timer.running);
    if (kind === 'stopwatch') timers.setStopwatchRunning(!timer.running);
    if (kind === 'alarm') { if (timer.running) timers.cancelAlarm(); else timers.armAlarm(); }
  }

  return (
    <article className="widget-tile" aria-label={title}>
      <div className="widget-heading"><Icon size={20} aria-hidden="true" /><h3>{title}</h3>
        {kind !== 'stopwatch' && <button className="widget-icon-button" aria-label={`Tilpass ${title.toLowerCase()}`} title={timer.running ? 'Sett timeren på pause for å tilpasse' : 'Tilpass'} disabled={timer.running || complete} onClick={() => setEditing(true)}><Settings2 size={18} /></button>}
        <button className="widget-icon-button" aria-label={`Fjern ${title} fra widgets`} onClick={onRemove}><X size={18} /></button>
      </div>
      <p className="widget-description">{complete ? 'Ferdig!' : subtitle}</p>
      <div className="widget-time" role="timer" aria-label={title}>{value}</div>
      {timer.kind === 'pomodoro' && <div className="widget-progress" role="progressbar" aria-label="Fremdrift i økten" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(100 * (1 - timer.remainingMs / timer.totalMs))}><span style={{ width: `${100 * (1 - timer.remainingMs / timer.totalMs)}%` }} /></div>}
      <div className="widget-controls widget-main-action">
        <button className="widget-button widget-primary" onClick={complete ? reset : toggle}>{timer.running ? <Pause size={18} /> : <Play size={18} />}{complete ? 'Stopp lyd' : timer.kind === 'alarm' ? (timer.running ? 'Deaktiver' : 'Aktiver') : timer.running ? 'Pause' : 'Start'}</button>
        {kind !== 'alarm' && <button className="widget-button" onClick={reset}><RotateCcw size={16} />Nullstill</button>}
      </div>
      {editing && <TimerSettingsDialog kind={kind} onClose={() => setEditing(false)} />}
    </article>
  );
}
