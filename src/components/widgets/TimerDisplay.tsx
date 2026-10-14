import { Flag, Pause, Play, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { TimerRing } from '@/components/timer/TimerRing';
import { EditableTimerTime } from '@/components/timer/EditableTimerTime';
import { useTimers } from '@/context/TimerContext';
import { formatHMS, formatStopwatch } from '@/lib/timerUtils';
import { WIDGET_KINDS, type TimerKind } from './widgetKinds';

export function TimerDisplay({ kind, expanded = false }: { kind: TimerKind; expanded?: boolean }) {
  const timers = useTimers();
  const timer = timers.getTimer(kind);
  const [validation, setValidation] = useState<{ valid: boolean; error: string | null }>({ valid: true, error: null });
  const [editorKey, setEditorKey] = useState(0);
  const { title } = WIDGET_KINDS[kind];
  const complete = (timer.kind === 'pomodoro' && timer.completed)
    || (timer.kind === 'countdown' && timer.remainingMs === 0 && timer.zeroedAt !== null)
    || (timer.kind === 'alarm' && timer.ringing);
  const value = timer.kind === 'alarm' ? timer.targetTime
    : timer.kind === 'stopwatch' ? (expanded ? formatStopwatch(timer.elapsedMs) : formatHMS(timer.elapsedMs / 1000))
      : formatHMS(Math.ceil(timer.remainingMs / 1000));
  const remaining = timer.kind === 'alarm' && timer.fireAt ? Math.max(0, timer.fireAt - Date.now()) : 0;
  const progress = timer.kind === 'stopwatch' ? (timer.elapsedMs % 60_000) / 60_000
    : timer.kind === 'alarm' ? (timer.running && timer.fireAt && timer.startedAt ? remaining / (timer.fireAt - timer.startedAt) : complete ? 0 : 1)
      : timer.totalMs > 0 ? timer.remainingMs / timer.totalMs : 0;
  const segments = timer.kind === 'pomodoro' ? {
    total: timer.settings.targetCycles,
    completed: timer.completed ? timer.settings.targetCycles : timer.cycle,
    currentProgress: timer.phase === 'focus' ? progress : 1,
  } : undefined;
  const phase = timer.kind === 'pomodoro' ? `${timer.phase === 'focus' ? 'Fokus' : 'Pause'} ${Math.min(timer.cycle + 1, timer.settings.targetCycles)}/${timer.settings.targetCycles}`
    : timer.kind === 'alarm' ? 'Ringer kl.' : timer.kind === 'stopwatch' ? 'Tid brukt' : 'Gjenstår';

  function reset() {
    setValidation({ valid: true, error: null });
    setEditorKey((key) => key + 1);
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
    <div className={`widget-timer-display${expanded ? ' is-expanded' : ''}`}>
      <div className="widget-timer-face">
        <TimerRing size={expanded ? 280 : 136} progress={progress} color={timer.color} running={timer.running} segments={segments}>
          <span className="widget-clock-label">{complete ? 'Ferdig' : phase}</span>
          {kind === 'stopwatch' ? <span className="widget-clock-value" data-long={value.length > (expanded ? 8 : 5)} role="timer" aria-label={title}>{value}</span>
            : <EditableTimerTime key={editorKey} value={value} label={title} disabled={timer.running || complete} clock={kind === 'alarm'}
              onValidationChange={(valid, error) => setValidation({ valid, error })}
              onChange={(next) => {
                if (kind === 'countdown') timers.setCountdownTime(Number(next));
                if (kind === 'pomodoro') timers.setPomodoroTime(Number(next));
                if (kind === 'alarm') timers.setAlarmTime(String(next));
              }} />}
        </TimerRing>
      </div>
      <div className="widget-timer-actions">
        <button className="widget-button widget-primary" disabled={!validation.valid && !timer.running && !complete} onClick={complete ? reset : toggle}>
          {timer.running ? <Pause size={16} /> : <Play size={16} />}
          {complete ? 'Stopp lyd' : kind === 'alarm' ? (timer.running ? 'Deaktiver' : 'Aktiver') : timer.running ? 'Pause' : 'Start'}
        </button>
        {kind !== 'alarm' && <button className="widget-button" onClick={reset}><RotateCcw size={16} />Nullstill</button>}
        {kind === 'stopwatch' && <button className="widget-button" disabled={!timer.running} onClick={timers.addStopwatchLap}><Flag size={16} />Runde</button>}
        {timer.kind === 'alarm' && timer.running && <span className="widget-timer-hint">Om {formatHMS(Math.ceil(remaining / 1000))}</span>}
      </div>
      {validation.error && <p className="widget-clock-error" role="alert">{validation.error}</p>}
      {expanded && timer.kind === 'stopwatch' && timer.laps.length > 0 && <ol className="widget-laps" aria-label="Rundetider">
        {timer.laps.map((lap, index) => <li key={timer.laps.length - index}>
          <span>Runde {timer.laps.length - index}</span>
          <span>+{formatStopwatch(lap - (timer.laps[index + 1] ?? 0))}</span>
          <strong>{formatStopwatch(lap)}</strong>
        </li>)}
      </ol>}
    </div>
  );
}
