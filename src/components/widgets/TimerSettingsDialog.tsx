import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useTimers } from '@/context/TimerContext';
import { WIDGET_KINDS, type TimerKind } from './widgetKinds';

export function TimerSettingsDialog({ kind, onClose }: { kind: TimerKind; onClose: () => void }) {
  const timers = useTimers();
  const countdown = timers.getTimer('countdown');
  const pomodoro = timers.getTimer('pomodoro');
  const [minutes, setMinutes] = useState(String(Math.max(1, countdown.totalMs / 60_000)));
  const [focus, setFocus] = useState(String(pomodoro.settings.focusMin));
  const [pause, setPause] = useState(String(pomodoro.settings.pauseMin));
  const [cycles, setCycles] = useState(String(pomodoro.settings.targetCycles));
  const [time, setTime] = useState(timers.getTimer('alarm').targetTime);
  return (
    <Modal open onOpenChange={(open) => { if (!open) onClose(); }} title={`Tilpass ${WIDGET_KINDS[kind].title.toLowerCase()}`} variant="standard">
      <form className="widget-dialog" onSubmit={(event) => {
        event.preventDefault();
        if (kind === 'countdown') timers.setCountdownTime(Number(minutes) * 60_000);
        if (kind === 'pomodoro') timers.updatePomodoroSettings({ focusMin: Number(focus), pauseMin: Number(pause), targetCycles: Number(cycles) });
        if (kind === 'alarm') timers.setAlarmTime(time);
        onClose();
      }}>
        {kind === 'countdown' && <label className="widget-field">Minutter<input type="number" required min="1" max="1440" step="1" value={minutes} onChange={(event) => setMinutes(event.target.value)} /></label>}
        {kind === 'pomodoro' && <>
          <label className="widget-field">Fokus (minutter)<input type="number" required min="1" max="180" value={focus} onChange={(event) => setFocus(event.target.value)} /></label>
          <label className="widget-field">Pause (minutter)<input type="number" required min="1" max="60" value={pause} onChange={(event) => setPause(event.target.value)} /></label>
          <label className="widget-field">Antall økter<input type="number" required min="1" max="12" value={cycles} onChange={(event) => setCycles(event.target.value)} /></label>
        </>}
        {kind === 'alarm' && <label className="widget-field">Klokkeslett<input type="time" required value={time} onChange={(event) => setTime(event.target.value)} /></label>}
        <div className="widget-controls"><button type="submit" className="widget-button widget-primary">Lagre</button><button type="button" className="widget-button" onClick={onClose}>Avbryt</button></div>
      </form>
    </Modal>
  );
}
