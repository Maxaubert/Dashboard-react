import { useWeather } from '@/hooks/useWeather';
import { describeWeather } from '@/api/weather';
import { WeatherScene, sceneForCode } from './weatherScene';
import { TempGraph } from './TempGraph';

const DAY_SHORT = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];

/** "2026-06-27T22:14" -> "22:14" */
const hhmm = (iso?: string) => (iso ? iso.slice(11, 16) : '--:--');

/** Vær — day/night scene, sunrise/sunset, temp graph + 5-day forecast. */
export function WeatherBentoCard() {
  const { location, forecast, isLoading, error } = useWeather();
  const current = forecast?.current;
  const desc = current ? describeWeather(current.weatherCode) : null;
  const isDay = current?.isDay ?? true;
  const scene = current ? sceneForCode(current.weatherCode, isDay) : 'cloudy';
  const wind = current ? Math.round(current.windSpeed) : 0;
  const windPct = Math.min(100, Math.round((wind / 15) * 100));

  const today = forecast?.daily?.[0];
  const days = (forecast?.daily ?? []).slice(0, 5);

  // 24h temperature window starting at the current hour (rolling, like the
  // Google graph). Falls back to the first 24 entries before data resolves.
  const graphPoints = (() => {
    const hourly = forecast?.hourly ?? [];
    if (hourly.length < 2) return [];
    const now = Date.now();
    let start = hourly.findIndex((h) => new Date(h.time).getTime() >= now);
    start = start < 0 ? 0 : Math.max(0, start - 1);
    return hourly.slice(start, start + 24).map((h) => ({ hour: h.hour, temp: h.temperature }));
  })();

  return (
    <section className="bento-card area-vaer">
      <div className={`viz ${scene}`}>
        {error ? (
          <div className="viz-msg">Kunne ikke hente vær.</div>
        ) : isLoading || !current || !desc ? (
          <div className="viz-msg">Laster værdata…</div>
        ) : (
          <>
            <div className="viz-hero">
              <WeatherScene scene={scene} />
              <div className="cond">{desc.label}</div>
              <div className="wloc">{location.name}</div>
              <div className="temp">{Math.round(current.temperature)}&deg;</div>
              <div className="wind">Vind {wind} m/s</div>
            </div>

            <div className="viz-body">
              <div className="meter">
                <span className="lab">Vind</span>
                <span className="track">
                  <i style={{ width: `${windPct}%` }} />
                </span>
                <span className="val">{wind} m/s</span>
              </div>

              {today && (
                <div className="suntimes">
                  <span className="suntime">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="14" r="4" />
                      <path d="M12 4v3M5 14H2M22 14h-3M6 8l-2-2M18 8l2-2M3 20h18" />
                    </svg>
                    Opp {hhmm(today.sunrise)}
                  </span>
                  <span className="suntime">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="14" r="4" />
                      <path d="M12 10V3M5 14H2M22 14h-3M6 8l-2-2M18 8l2-2M3 20h18M8 6l4 4 4-4" />
                    </svg>
                    Ned {hhmm(today.sunset)}
                  </span>
                </div>
              )}

              {graphPoints.length > 1 && <TempGraph points={graphPoints} />}

              {days.length > 0 && (
                <div className="fc">
                  {days.map((d) => {
                    const dt = new Date(d.date + 'T12:00:00');
                    const di = describeWeather(d.weatherCode);
                    return (
                      <div key={d.date}>
                        <div className="d">{DAY_SHORT[dt.getDay()]}</div>
                        <div className="fc-ic">{di.icon}</div>
                        <div className="fc-temps">
                          <strong>{Math.round(d.tempMax)}&deg;</strong>
                          <span>{Math.round(d.tempMin)}&deg;</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
