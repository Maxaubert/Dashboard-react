import { useWeather } from '@/hooks/useWeather';
import { describeWeather } from '@/api/weather';
import { WeatherScene, sceneForCode } from './weatherScene';

const DAY_SHORT = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];

/** Vær — dynamic SVG weather scene + temp + 5-day forecast strip. */
export function WeatherBentoCard() {
  const { location, forecast, isLoading, error } = useWeather();
  const current = forecast?.current;
  const desc = current ? describeWeather(current.weatherCode) : null;
  const scene = current ? sceneForCode(current.weatherCode) : 'cloudy';

  // Meter shows wind as a fraction of a 15 m/s reference — a real,
  // sensible read-out in place of the mockup's static "sol i dag" bar.
  const wind = current ? Math.round(current.windSpeed) : 0;
  const windPct = Math.min(100, Math.round((wind / 15) * 100));

  const days = (forecast?.daily ?? []).slice(0, 5);

  return (
    <section className="bento-card area-vaer">
      <div className="ch">
        <h2>Vær</h2>
        <span className="ch-note">Open-Meteo</span>
      </div>

      <div className={`viz ${scene}`}>
        {error ? (
          <div className="viz-msg">Kunne ikke hente vær.</div>
        ) : isLoading || !current || !desc ? (
          <div className="viz-msg">Laster værdata…</div>
        ) : (
          <>
            <WeatherScene scene={scene} />
            <div className="cond">{desc.label}</div>
            <div className="wloc">{location.name}</div>
            <div className="temp">{Math.round(current.temperature)}&deg;</div>
            <div className="wind">Vind {wind} m/s</div>
          </>
        )}
      </div>

      <div className="meter">
        <span className="lab">Vind</span>
        <span className="track">
          <i style={{ width: `${windPct}%` }} />
        </span>
        <span className="val">{wind} m/s</span>
      </div>

      {days.length > 0 && (
        <div className="fc">
          {days.map((d) => {
            const dt = new Date(d.date + 'T12:00:00');
            return (
              <div key={d.date}>
                <div className="d">{DAY_SHORT[dt.getDay()]}</div>
                <div className="t">{Math.round(d.tempMax)}&deg;</div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
