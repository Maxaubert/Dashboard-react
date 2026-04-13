import { motion, AnimatePresence } from 'framer-motion';
import { useTimers } from '@/context/TimerContext';
import { formatStopwatch } from '@/hooks/useTimer';
import { TimerRing } from './TimerRing';
import { StopwatchControls } from './TimerControls';

export function StopwatchMode() {
  const ctx = useTimers();
  const sw = ctx.getTimer('stopwatch');

  return (
    <div className="tt-mode-body">
      <TimerRing progress={1} color={sw.color} running={sw.running}>
        <div className="tt-ring-label" style={{ color: sw.color }}>STOPWATCH</div>
        <div className="tt-ring-text">{formatStopwatch(sw.elapsedMs)}</div>
      </TimerRing>
      <StopwatchControls
        running={sw.running}
        elapsedMs={sw.elapsedMs}
        lapsCount={sw.laps.length}
        color={sw.color}
        onToggle={() => ctx.setStopwatchRunning(!sw.running)}
        onLap={ctx.addStopwatchLap}
        onReset={ctx.resetStopwatch}
      />
      {sw.laps.length > 0 && (
        <div className="tt-lap-list">
          <AnimatePresence initial={false}>
            {sw.laps.map((lap, i) => {
              const lapIndex = sw.laps.length - i;
              const prev = sw.laps[i + 1] ?? 0;
              const diff = lap - prev;
              return (
                <motion.div
                  key={lapIndex}
                  className="tt-lap-row"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  layout
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  style={i === 0 ? { borderColor: `${sw.color}30` } : undefined}
                >
                  <span className="tt-lap-num">#{String(lapIndex).padStart(2, '0')}</span>
                  <span className="tt-lap-diff">+{formatStopwatch(diff)}</span>
                  <span className="tt-lap-time">{formatStopwatch(lap)}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
