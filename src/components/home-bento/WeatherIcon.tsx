import type { WeatherIconKey } from '@/lib/weatherIcons';

/**
 * Stroke icons for the forecast row. Every glyph lives in the same 22x22
 * box with the same 1.5 stroke, so a column of them lines up with the
 * mono labels and the temperatures beneath, unlike emoji.
 */

/** Cloud outline centred in the box; precipitation variants lift it 3 units. */
const CLOUD = 'M15.5 17.5H8.5a5.5 5.5 0 1 1 5.3-7h1.7a3.5 3.5 0 1 1 0 7Z';

function Cloud({ lifted = false }: { lifted?: boolean }) {
  return <path d={CLOUD} transform={lifted ? 'translate(0 -3)' : undefined} />;
}

function Dots({ points }: { points: [number, number][] }) {
  return (
    <g fill="currentColor" stroke="none">
      {points.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={0.9} />
      ))}
    </g>
  );
}

const GLYPHS: Record<WeatherIconKey, () => JSX.Element> = {
  sun: () => (
    <>
      <circle cx={11} cy={11} r={3.5} />
      <path d="M11 4v1.5M11 16.5V18M4 11h1.5M16.5 11H18M6.05 6.05l1.05 1.05M14.9 14.9l1.05 1.05M6.05 15.95l1.05-1.05M14.9 7.1l1.05-1.05" />
    </>
  ),
  moon: () => <path d="M11 2.75a5.5 5.5 0 0 0 8.25 8.25 8.25 8.25 0 1 1-8.25-8.25Z" />,
  partly: () => (
    <>
      <circle cx={15} cy={7.5} r={2.8} />
      <path d="M15 3.5v-1M19 7.5h1M17.8 4.7l.7-.7M12.2 4.7l-.7-.7M11 7.5h-1M17.8 10.3l.7.7" />
      <path d="M11.1 19H6a4 4 0 1 1 3.9-5h1.2a2.5 2.5 0 1 1 0 5Z" />
    </>
  ),
  cloud: () => <Cloud />,
  fog: () => (
    <>
      <Cloud lifted />
      <path d="M6 17.5h10M8 20.5h8" />
    </>
  ),
  drizzle: () => (
    <>
      <Cloud lifted />
      <path d="M8 16.5v1.2M11.5 17.5v1.2M15 16.5v1.2M9.75 19.5v1.2M13.25 19.5v1.2" />
    </>
  ),
  rain: () => (
    <>
      <Cloud lifted />
      <path d="M8 16.5v3.5M11.5 17.5v3.5M15 16.5v3.5" />
    </>
  ),
  snow: () => (
    <>
      <Cloud lifted />
      <Dots
        points={[
          [8, 17],
          [15, 17],
          [11.5, 18.5],
          [9.75, 20.3],
          [13.25, 20.3],
        ]}
      />
    </>
  ),
  thunder: () => (
    <>
      <Cloud lifted />
      <path d="M12.6 15l-2.6 3.4h3.2L10.8 21.5" />
    </>
  ),
};

export function WeatherIcon({ icon, className }: { icon: WeatherIconKey; className?: string }) {
  const Glyph = GLYPHS[icon];
  return (
    <svg
      className={className}
      viewBox="0 0 22 22"
      width={22}
      height={22}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <Glyph />
    </svg>
  );
}
