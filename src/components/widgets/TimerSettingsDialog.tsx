import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useTimers } from '@/context/TimerContext';
import { WIDGET_KINDS, type TimerKind } from './widgetKinds';
import { TimerDisplay } from './TimerDisplay';

export function TimerSettingsDialog({ kind, onClose }: { kind: TimerKind; onClose: () => void }) {
  const timer = useTimers().getTimer(kind);
  const settingsKey = timer.kind === 'countdown' ? timer.totalMs
    : timer.kind === 'alarm' ? timer.targetTime
      : timer.kind === 'pomodoro' ? JSON.stringify(timer.settings) : kind;
  return (
    <Modal open onOpenChange={(open) => { if (!open) onClose(); }} title={`Tilpass ${WIDGET_KINDS[kind].title.toLowerCase()}`} variant="standard" size="lg"
      onEscapeKeyDown={(event) => {
        if (event.target instanceof HTMLInputElement && event.target.classList.contains('widget-clock-input')) event.preventDefault();
      }}>
      <div className="widget-timer-dialog">
        <TimerDisplay kind={kind} expanded />
        {kind !== 'stopwatch' && <TimerSettingsForm key={settingsKey} kind={kind} onClose={onClose} />}
      </div>
    </Modal>
  );
}

function TimerSettingsForm({ kind, onClose }: { kind: TimerKind; onClose: () => void }) {
  const timers = useTimers();
  const running = timers.getTimer(kind).running;
  const countdown = timers.getTimer('countdown');
  const pomodoro = timers.getTimer('pomodoro');
  const [minutes, setMinutes] = useState(String(countdown.totalMs / 60_000));
  const [focus, setFocus] = useState(String(pomodoro.settings.focusMin));
  const [pause, setPause] = useState(String(pomodoro.settings.pauseMin));
  const [cycles, setCycles] = useState(String(pomodoro.settings.targetCycles));
  const [time, setTime] = useState(timers.getTimer('alarm').targetTime);
  return (
      <form className="widget-dialog widget-timer-settings" onSubmit={(event) => {
        event.preventDefault();
        if (running) return;
        if (kind === 'countdown') timers.setCountdownTime(Number(minutes) * 60_000);
        if (kind === 'pomodoro') timers.updatePomodoroSettings({ focusMin: Number(focus), pauseMin: Number(pause), targetCycles: Number(cycles) });
        if (kind === 'alarm') timers.setAlarmTime(time);
        onClose();
      }}>
        <fieldset disabled={running}>
        {kind === 'countdown' && <label className="widget-field">Minutter<input type="number" required min="0.016666666666666666" max="1440" step="any" value={minutes} onChange={(event) => setMinutes(event.target.value)} /></label>}
        {kind === 'pomodoro' && <>
          <label className="widget-field">Fokus (minutter)<input type="number" required min="1" max="180" step="1" value={focus} onChange={(event) => setFocus(event.target.value)} /></label>
          <label className="widget-field">Pause (minutter)<input type="number" required min="1" max="60" step="1" value={pause} onChange={(event) => setPause(event.target.value)} /></label>
          <label className="widget-field">Antall økter<input type="number" required min="1" max="12" step="1" value={cycles} onChange={(event) => setCycles(event.target.value)} /></label>
        </>}
        {kind === 'alarm' && <label className="widget-field">Klokkeslett<input type="time" required value={time} onChange={(event) => setTime(event.target.value)} /></label>}
        </fieldset>
        {running && <p className="widget-timer-hint">Sett timeren på pause for å endre innstillingene.</p>}
        <div className="widget-controls"><button type="submit" className="widget-button widget-primary" disabled={running}>Lagre</button><button type="button" className="widget-button" onClick={onClose}>Avbryt</button></div>
      </form>
  );
}
