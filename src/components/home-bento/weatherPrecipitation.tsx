import type { CSSProperties } from 'react';
import { rainDrops, snowFlakes } from '@/lib/precipitation';

/**
 * Layered rain and snow for the weather hero SVG (viewBox 220x200).
 *
 * The cloud in the rain / snow / thunder scenes sits at translate(66 66)
 * scale(1.15), so it spans roughly x 68..160 with its base at y 112. The
 * particle band starts just under that base. Parameters come from the
 * deterministic generators in lib/precipitation, so every render draws the
 * same field and nothing is randomised at render time.
 */
const BAND = { x: 72, width: 84, y: 116 };

const DROPS = rainDrops(BAND);
const FLAKES = snowFlakes(BAND);

type ParticleStyle = CSSProperties & { '--p-o'?: number; '--p-sway'?: string };

/** Faint mist pooling under the cloud so the precipitation has a floor to fade into. */
export function Mist({ tint }: { tint: string }) {
  return (
    <>
      <defs>
        <radialGradient id="bento-mist" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={tint} stopOpacity={0.16} />
          <stop offset="60%" stopColor={tint} stopOpacity={0.05} />
          <stop offset="100%" stopColor={tint} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse className="mist" cx={116} cy={168} rx={78} ry={26} fill="url(#bento-mist)" />
    </>
  );
}

export function Raindrops() {
  return (
    <g stroke="#8fb6e0" strokeLinecap="round">
      {DROPS.map((d, i) => (
        <line
          key={i}
          className="drop"
          style={
            {
              '--p-o': d.opacity,
              animationDuration: `${d.duration}s`,
              animationDelay: `${d.delay}s`,
            } as ParticleStyle
          }
          strokeWidth={d.width}
          x1={d.x}
          y1={d.y}
          x2={d.x + d.slant}
          y2={d.y + d.length}
        />
      ))}
    </g>
  );
}

export function Snowflakes() {
  return (
    <g fill="#cfe0f2">
      {FLAKES.map((f, i) => (
        <circle
          key={i}
          className="flake"
          style={
            {
              '--p-o': f.opacity,
              '--p-sway': `${f.sway}px`,
              animationDuration: `${f.duration}s`,
              animationDelay: `${f.delay}s`,
            } as ParticleStyle
          }
          cx={f.x}
          cy={f.y}
          r={f.radius}
        />
      ))}
    </g>
  );
}
