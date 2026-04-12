import { useCallback } from 'react';
import { useCountdown, playAlarm, notify } from '@/hooks/useTimer';
import { TimerRing } from './TimerRing';
import { CountdownControls, EditableTime } from './TimerControls';

const COLOR = '#ef4444';
const DEFAULT_MS = 5 * 60_000;

export function CountdownMode() {
  const onFinish = useCallback(() => {
    playAlarm();
    notify('Timer ferdig', 'Nedtelling er over.');
  }, []);

  const timer = useCountdown({ initialMs: DEFAULT_MS, onFinish });

  return (
    <div className="tt-mode-body">
      <TimerRing progress={timer.progress} color={COLOR} running={timer.running}>
        {timer.finished && (
          <div className="tt-ring-label" style={{ color: COLOR }}>FERDIG</div>
        )}
        <EditableTime
          ms={timer.remainingMs}
          color={COLOR}
          onChange={timer.setTime}
          disabled={timer.running}
        />
      </TimerRing>
      <CountdownControls
        running={timer.running}
        finished={timer.finished}
        color={COLOR}
        onToggle={() => timer.setRunning((r) => !r)}
        onReset={timer.reset}
      />
    </div>
  );
}
