import { useTimers } from '@/context/TimerContext';
import { TimerRing } from './TimerRing';
import { CountdownControls, EditableTime } from './TimerControls';

export function CountdownMode() {
  const ctx = useTimers();
  const t = ctx.getTimer('countdown');
  const progress = t.totalMs > 0 ? t.remainingMs / t.totalMs : 0;
  const finished = t.remainingMs === 0;

  return (
    <div className="tt-mode-body">
      <TimerRing progress={progress} color={t.color} running={t.running}>
        {finished && <div className="tt-ring-label" style={{ color: t.color }}>FERDIG</div>}
        <EditableTime
          ms={t.remainingMs}
          color={t.color}
          onChange={ctx.setCountdownTime}
          disabled={t.running}
        />
      </TimerRing>
      <CountdownControls
        running={t.running}
        finished={finished}
        color={t.color}
        onToggle={() => ctx.setCountdownRunning(!t.running)}
        onReset={ctx.resetCountdown}
      />
    </div>
  );
}
