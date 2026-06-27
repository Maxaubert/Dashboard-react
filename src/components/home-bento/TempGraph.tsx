/**
 * Compact temperature-over-the-day line/area chart for the Vær bento card.
 *
 * The curve is drawn in a normalised 0–100 viewBox with
 * `preserveAspectRatio="none"` so it stretches to the card width; the line
 * keeps a constant thickness via `vector-effect="non-scaling-stroke"`. Temp
 * and hour labels are HTML overlays positioned by percentage so text never
 * distorts.
 */

interface Pt {
  hour: number;
  temp: number;
}

export function TempGraph({ points }: { points: Pt[] }) {
  if (points.length < 2) return null;

  const temps = points.map((p) => p.temp);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const span = max - min || 1;
  const n = points.length;

  // Keep the line in the upper band (TOP..BOT); the area fills below to 100.
  const TOP = 16;
  const BOT = 74;
  const coords = points.map((p, i) => {
    const x = (i / (n - 1)) * 100;
    const y = BOT - ((p.temp - min) / span) * (BOT - TOP);
    return { x, y, hour: p.hour, temp: p.temp };
  });

  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`).join(' ');
  const area =
    `M ${coords[0].x.toFixed(2)} 100 ` +
    coords.map((c) => `L ${c.x.toFixed(2)} ${c.y.toFixed(2)}`).join(' ') +
    ` L ${coords[n - 1].x.toFixed(2)} 100 Z`;

  // Label roughly every 3 hours (≈ 8 labels across a 24h window).
  const step = Math.max(1, Math.round(n / 8));
  const labels = coords.filter((_, i) => i % step === 0);

  return (
    <div className="tgraph">
      <div className="tgraph-plot">
        <svg className="tgraph-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="tg-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(232,177,58,0.30)" />
              <stop offset="100%" stopColor="rgba(232,177,58,0)" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#tg-area)" />
          <path
            d={line}
            fill="none"
            stroke="#e8b13a"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
        {labels.map((c, k) => (
          <span key={k} className="tgraph-temp" style={{ left: `${c.x}%`, top: `${c.y}%` }}>
            {Math.round(c.temp)}&deg;
          </span>
        ))}
      </div>
      <div className="tgraph-hours">
        {labels.map((c, k) => (
          <span key={k} style={{ left: `${c.x}%` }}>
            {String(c.hour).padStart(2, '0')}
          </span>
        ))}
      </div>
    </div>
  );
}
