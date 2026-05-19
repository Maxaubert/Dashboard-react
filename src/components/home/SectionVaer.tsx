import { useState } from 'react';
import { useWeather } from '@/hooks/useWeather';
import { searchLocation, describeWeather } from '@/api/weather';
import { GripHandle, type HandleProps } from '@/components/home/GripHandle';

export function VaerSection({ handleProps }: { handleProps?: HandleProps }) {
  const { location, setLocation, forecast, isLoading, error } = useWeather();
  const [editing, setEditing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchError, setSearchError] = useState('');

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchError('');
    try {
      const hit = await searchLocation(searchInput);
      if (!hit) {
        setSearchError('Fant ingen sted');
        return;
      }
      setLocation(hit);
      setEditing(false);
      setSearchInput('');
    } catch {
      setSearchError('Kunne ikke søke');
    }
  }

  const dayShort = (date: string, idx: number) => {
    if (idx === 0) return 'I dag';
    const d = new Date(date + 'T12:00:00');
    return ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'][d.getDay()];
  };

  const current = forecast?.current;
  const desc = current ? describeWeather(current.weatherCode) : null;

  return (
    <section>
      <div className="section-header">
        <span>
          <GripHandle handleProps={handleProps} />
          Vær
        </span>
        <span
          style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
          }}
        >
          Open-Meteo
        </span>
      </div>

      <div className="weather-card">
        <div className="weather-current">
          <div className="weather-location">
            <span>
              {location.name}
              {location.admin1 && location.admin1 !== location.name && `, ${location.admin1}`}
            </span>
            <button
              type="button"
              onClick={() => setEditing((s) => !s)}
              aria-label="Endre sted"
              title="Endre sted"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
          </div>
          {editing && (
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <input
                type="text"
                placeholder="By eller sted…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                autoFocus
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  color: 'var(--color-text)',
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontSize: '0.78rem',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <button type="submit" className="modal-btn-primary" style={{ flex: '0 0 auto', padding: '6px 12px', fontSize: '0.78rem' }}>
                Søk
              </button>
            </form>
          )}
          {searchError && (
            <span style={{ fontSize: '0.7rem', color: '#f87171' }}>{searchError}</span>
          )}

          {error ? (
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              Kunne ikke hente vær.
            </span>
          ) : isLoading || !current || !desc ? (
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              Laster værdata…
            </span>
          ) : (
            <>
              <div className="weather-temp">
                <span className="weather-icon-big">{desc.icon}</span>
                <span className="weather-temp-main">{Math.round(current.temperature)}°</span>
              </div>
              <div className="weather-desc">
                {desc.label} · vind {Math.round(current.windSpeed)} m/s
              </div>
            </>
          )}
        </div>

        {forecast && forecast.hourly.length > 0 && (
          <div className="weather-section">
            <div className="weather-section-label">I dag</div>
            <div className="weather-hourly">
              {pickHourlySlots(forecast.hourly).map((h) => {
                const hDesc = describeWeather(h.weatherCode);
                return (
                  <div key={h.time} className="weather-hour">
                    <span className="weather-hour-label">
                      {String(h.hour).padStart(2, '0')}
                    </span>
                    <span className="weather-hour-icon">{hDesc.icon}</span>
                    <span className="weather-hour-temp">
                      {Math.round(h.temperature)}°
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {forecast && (
          <div className="weather-section">
            <div className="weather-section-label">Uken</div>
            <div className="weather-daily">
              {forecast.daily.map((d, i) => {
                const dDesc = describeWeather(d.weatherCode);
                return (
                  <div key={d.date} className="weather-day">
                    <span className="weather-day-label">{dayShort(d.date, i)}</span>
                    <span className="weather-day-icon">{dDesc.icon}</span>
                    <span className="weather-day-temps">
                      <strong>{Math.round(d.tempMax)}°</strong>
                      <br />
                      {Math.round(d.tempMin)}°
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Pick a stable set of hour-of-day slots to display in the hourly
 * widget. We show fixed times (06, 09, 12, 15, 18, 21) for today so
 * the layout doesn't shift around as the clock ticks. If a slot is
 * already in the past, fall back to the next available hour from
 * the upcoming forecast (so the widget stays useful in the evening).
 */
function pickHourlySlots(hourly: import('@/api/weather').HourlyForecast[]) {
  if (hourly.length === 0) return [];
  const TARGET_HOURS = [6, 9, 12, 15, 18, 21];
  const now = new Date();
  const currentHour = now.getHours();

  // Open-Meteo returns hours in chronological order starting from
  // midnight today. The first 24 entries are today's hours.
  const today = hourly.slice(0, 24);

  // Pick today's hours that haven't passed yet
  const futureToday = TARGET_HOURS
    .filter((h) => h >= currentHour)
    .map((h) => today[h])
    .filter(Boolean);

  // If we don't have enough slots left in today (e.g. it's already
  // past 21:00), fill from tomorrow's hours so we always show 6 cards.
  if (futureToday.length >= 6) return futureToday.slice(0, 6);
  const tomorrow = hourly.slice(24, 48);
  const fillFromTomorrow = TARGET_HOURS
    .map((h) => tomorrow[h])
    .filter(Boolean)
    .slice(0, 6 - futureToday.length);
  return [...futureToday, ...fillFromTomorrow];
}
