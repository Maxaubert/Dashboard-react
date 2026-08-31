import { useState } from 'react';
import { searchLocation, type GeoLocation } from '@/api/weather';

interface Props {
  location: GeoLocation;
  onSelect: (location: GeoLocation) => void;
}

type Status = 'idle' | 'searching' | 'notfound' | 'failed';

const STATUS_TEXT: Record<Exclude<Status, 'idle'>, string> = {
  searching: 'Søker…',
  notfound: 'Fant ingen sted',
  failed: 'Kunne ikke søke',
};

/**
 * Location name in the top-right of the weather hero, with a pencil that
 * flips it into a tiny city search. Picking a hit saves it via `onSelect`
 * (useWeather stores it, so geolocation stops overriding it).
 */
export function WeatherLocationPicker({ location, onSelect }: Props) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  const fullName =
    location.admin1 && location.admin1 !== location.name
      ? `${location.name}, ${location.admin1}`
      : location.name;

  function open() {
    setQuery('');
    setStatus('idle');
    setEditing(true);
  }

  function close() {
    setEditing(false);
    setStatus('idle');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || status === 'searching') return;
    setStatus('searching');
    try {
      const hit = await searchLocation(query);
      if (!hit) {
        setStatus('notfound');
        return;
      }
      onSelect(hit);
      close();
    } catch {
      setStatus('failed');
    }
  }

  if (!editing) {
    return (
      <div className="wloc" title={fullName}>
        <span>{location.name}</span>
        <button type="button" className="wloc-btn" onClick={open} aria-label="Endre sted" title="Endre sted">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <form className="wloc wloc-form" onSubmit={handleSubmit}>
      <div className="wloc-row">
        <input
          type="text"
          className="wloc-input"
          placeholder="By eller sted…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close();
          }}
          aria-label="Søk etter sted"
          autoFocus
        />
        <button type="submit" className="wloc-submit" disabled={status === 'searching'}>
          Søk
        </button>
        <button type="button" className="wloc-btn" onClick={close} aria-label="Avbryt" title="Avbryt">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      {status !== 'idle' && (
        <div className={`wloc-status${status === 'searching' ? '' : ' err'}`} role="status">
          {STATUS_TEXT[status]}
        </div>
      )}
    </form>
  );
}
