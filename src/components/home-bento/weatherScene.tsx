/**
 * Dynamic SVG weather scenes — ported from mockups/bento-dashboard.html.
 *
 * `sceneForCode` maps an open-meteo WMO weather code to one of five scenes
 * (sunny / partly / cloudy / rain / snow). `WeatherScene` renders the SVG
 * sky for a given scene key. The scene key is also used as the `.viz`
 * background class in bento.css.
 */

export type SceneKey = 'sunny' | 'partly' | 'cloudy' | 'rain' | 'snow' | 'moon' | 'moon-partly';

/**
 * Map an open-meteo WMO weather code to a scene key. When `isDay` is false
 * the clear / mostly-clear scenes swap the sun for a moon; cloud, rain and
 * snow look the same day or night.
 */
export function sceneForCode(code: number, isDay = true): SceneKey {
  if (code === 0) return isDay ? 'sunny' : 'moon';
  if (code === 1 || code === 2) return isDay ? 'partly' : 'moon-partly';
  if (code === 3 || code === 45 || code === 48) return 'cloudy';
  if (code >= 71 && code <= 77) return 'snow';
  if (code === 85 || code === 86) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) {
    return 'rain';
  }
  return 'cloudy';
}

function Sun({ cx, cy, r, rays }: { cx: number; cy: number; r: number; rays: boolean }) {
  const lines = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const x1 = cx + Math.cos(a) * (r + 8);
    const y1 = cy + Math.sin(a) * (r + 8);
    const x2 = cx + Math.cos(a) * (r + 18);
    const y2 = cy + Math.sin(a) * (r + 18);
    return <line key={i} x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)} />;
  });
  return (
    <>
      <defs>
        <radialGradient id="bento-sg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffe6a8" />
          <stop offset="55%" stopColor="#ffc861" />
          <stop offset="100%" stopColor="#f0a23a" />
        </radialGradient>
        <radialGradient id="bento-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffce6e" stopOpacity={0.55} />
          <stop offset="55%" stopColor="#ffb347" stopOpacity={0.16} />
          <stop offset="100%" stopColor="#ffb347" stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* Soft halo behind the sun, centred on it so it always sits behind. */}
      <circle cx={cx} cy={cy} r={r * 2.8} fill="url(#bento-glow)" />
      <circle cx={cx} cy={cy} r={r} fill="url(#bento-sg)" />
      {rays && (
        <g className="rays" stroke="#ffce6e" strokeWidth={3} strokeLinecap="round">
          {lines}
        </g>
      )}
    </>
  );
}

function Moon({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  // Crescent: a lit disc with an offset disc masked out of its upper-right.
  return (
    <>
      <defs>
        <radialGradient id="bento-moon" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#eaf0ff" />
          <stop offset="70%" stopColor="#c3d0f2" />
          <stop offset="100%" stopColor="#9aabd8" />
        </radialGradient>
        <radialGradient id="bento-moonglow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#aebfe8" stopOpacity={0.4} />
          <stop offset="60%" stopColor="#7d8fc0" stopOpacity={0.12} />
          <stop offset="100%" stopColor="#7d8fc0" stopOpacity={0} />
        </radialGradient>
        <mask id="bento-crescent">
          <rect x={cx - r * 2} y={cy - r * 2} width={r * 4} height={r * 4} fill="white" />
          <circle cx={cx + r * 0.6} cy={cy - r * 0.32} r={r * 0.96} fill="black" />
        </mask>
      </defs>
      <circle cx={cx} cy={cy} r={r * 2.6} fill="url(#bento-moonglow)" />
      <circle cx={cx} cy={cy} r={r} fill="url(#bento-moon)" mask="url(#bento-crescent)" />
      {/* a couple of faint stars */}
      <g fill="#cdd6f0">
        <circle cx={cx - r * 2.4} cy={cy - r * 1.1} r={1.4} opacity={0.7} />
        <circle cx={cx - r * 1.5} cy={cy + r * 1.6} r={1.1} opacity={0.5} />
        <circle cx={cx + r * 1.9} cy={cy + r * 1.2} r={1.2} opacity={0.6} />
      </g>
    </>
  );
}

function Cloud({ x, y, s, fill }: { x: number; y: number; s: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill}>
      <circle cx={18} cy={20} r={16} />
      <circle cx={40} cy={12} r={22} />
      <circle cx={66} cy={20} r={16} />
      <rect x={14} y={20} width={56} height={20} rx={10} />
    </g>
  );
}

function Raindrops({ x, y }: { x: number; y: number }) {
  return (
    <g stroke="#8fb6e0" strokeWidth={2.5} strokeLinecap="round">
      {Array.from({ length: 7 }, (_, i) => (
        <line
          key={i}
          className="drop"
          style={{ animationDelay: `${(i * 0.13).toFixed(2)}s` }}
          x1={x + i * 16}
          y1={y}
          x2={x + i * 16 - 4}
          y2={y + 10}
        />
      ))}
    </g>
  );
}

function Snowflakes({ x, y }: { x: number; y: number }) {
  return (
    <g fill="#cfe0f2">
      {Array.from({ length: 7 }, (_, i) => (
        <circle
          key={i}
          className="flake"
          style={{ animationDelay: `${(i * 0.4).toFixed(2)}s` }}
          cx={x + i * 16}
          cy={y}
          r={2.6}
        />
      ))}
    </g>
  );
}

/** The animated sky SVG for a given scene. */
export function WeatherScene({ scene }: { scene: SceneKey }) {
  return (
    <svg className="wsky" viewBox="0 0 220 200" preserveAspectRatio="xMidYMid meet">
      {scene === 'sunny' && <Sun cx={132} cy={70} r={30} rays />}
      {scene === 'partly' && (
        <>
          <Sun cx={150} cy={52} r={22} rays />
          <Cloud x={70} y={86} s={1.05} fill="#c7ccd4" />
        </>
      )}
      {scene === 'moon' && <Moon cx={130} cy={72} r={26} />}
      {scene === 'moon-partly' && (
        <>
          <Moon cx={148} cy={54} r={20} />
          <Cloud x={70} y={88} s={1.05} fill="#aeb6c8" />
        </>
      )}
      {scene === 'cloudy' && (
        <>
          <Cloud x={40} y={52} s={0.8} fill="#9aa0ab" />
          <Cloud x={78} y={90} s={1.1} fill="#c2c7cf" />
        </>
      )}
      {scene === 'rain' && (
        <>
          <Cloud x={66} y={66} s={1.15} fill="#9098a4" />
          <Raindrops x={78} y={128} />
        </>
      )}
      {scene === 'snow' && (
        <>
          <Cloud x={66} y={66} s={1.15} fill="#aab4c2" />
          <Snowflakes x={78} y={128} />
        </>
      )}
    </svg>
  );
}
