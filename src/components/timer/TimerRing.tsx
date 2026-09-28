import { type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface TimerRingProps {
  progress: number;         // 0-1 overall progress
  color: string;            // accent color for stroke and glow
  children: ReactNode;      // center content (time, label)
  segments?: {              // if set, renders segmented ring for pomodoro
    total: number;
    completed: number;
    currentProgress: number; // 0-1 how far through current segment
  };
  running?: boolean;        // enables stronger glow when running
  size?: number;            // outer SVG size in px (default 300)
}

export function TimerRing({ progress, color, children, segments, running, size = 300 }: TimerRingProps) {
  const reducedMotion = useReducedMotion();
  const VIEWBOX = size;
  const CX = size / 2;
  const CY = size / 2;
  const R = (size / 2) - (size < 200 ? 10 : 20);
  const CIRCUMFERENCE = 2 * Math.PI * R;
  const STROKE_WIDTH = Math.max(4, Math.round(size / 37.5));

  const glowFilter = `drop-shadow(0 0 ${running ? 5 : 2}px ${color}30)`;

  return (
    <div className="tt-ring-wrap" style={{ width: size, height: size }}>
      <svg
        className="tt-ring"
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        aria-hidden="true"
        style={{ filter: glowFilter, transition: 'filter 0.5s' }}
      >
        {/* Track */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={STROKE_WIDTH} />

        {segments ? (
          <SegmentedRing
            total={segments.total}
            completed={segments.completed}
            currentProgress={segments.currentProgress}
            reducedMotion={Boolean(reducedMotion)}
            color={color}
            cx={CX}
            cy={CY}
            r={R}
            circumference={CIRCUMFERENCE}
            strokeWidth={STROKE_WIDTH}
          />
        ) : (
          <motion.circle
            cx={CX} cy={CY} r={R}
            fill="none" stroke={color} strokeWidth={STROKE_WIDTH} strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={false}
            animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, progress))) }}
            transition={{ duration: reducedMotion ? 0 : 0.3, ease: 'easeOut' }}
            transform={`rotate(-90 ${CX} ${CY})`}
            opacity={0.9}
          />
        )}
      </svg>
      <div className="tt-ring-center">{children}</div>
    </div>
  );
}

interface SegmentedRingProps {
  reducedMotion: boolean;
  total: number;
  completed: number;
  currentProgress: number;
  color: string;
  cx: number;
  cy: number;
  r: number;
  circumference: number;
  strokeWidth: number;
}

function SegmentedRing({ reducedMotion, total, completed, currentProgress, color, cx, cy, r, circumference, strokeWidth }: SegmentedRingProps) {
  // Hard cap the segment count so bad data (e.g. from older localStorage) can't
  // render tens of thousands of DOM nodes and freeze the page.
  const safeTotal = Math.min(Math.max(1, total | 0), 12);
  const gapAngle = 4;
  const totalGap = gapAngle * safeTotal;
  const segmentAngle = (360 - totalGap) / safeTotal;
  const segmentArc = (segmentAngle / 360) * circumference;

  return (
    <>
      {Array.from({ length: safeTotal }, (_, i) => {
        let opacity: number;
        let arcLength: number;

        if (i < completed) {
          // Completed segments: empty (depleted)
          opacity = 0.08; arcLength = segmentArc;
        } else if (i === completed) {
          // Current segment: starts full, depletes as time runs out
          opacity = 0.9; arcLength = segmentArc * currentProgress;
        } else {
          // Future segments: full (not yet started)
          opacity = 0.9; arcLength = segmentArc;
        }

        // Segments laid out counter-clockwise from the top. Each segment's
        // path origin is rotated so the arc ends at the top edge (for i=0)
        // and each subsequent segment wraps further counter-clockwise.
        const rotation = -90 - (i + 1) * segmentAngle - i * gapAngle;

        // Completed segments snap instantly to their "dim track" state so
        // the just-finished focus segment doesn't appear to briefly grow
        // back to full before fading.
        const transitionDuration = i < completed ? 0 : 0.5;

        return (
          <motion.circle
            key={i} cx={cx} cy={cy} r={r}
            fill="none"
            stroke={i < completed ? 'rgba(255,255,255,1)' : color}
            strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference - arcLength}`}
            transform={`rotate(${rotation} ${cx} ${cy})`}
            opacity={opacity}
            initial={false}
            animate={{ strokeDasharray: `${arcLength} ${circumference - arcLength}`, opacity }}
            transition={{ duration: reducedMotion ? 0 : transitionDuration, ease: 'easeOut' }}
          />
        );
      })}
    </>
  );
}
