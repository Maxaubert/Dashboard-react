import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchForecast,
  reverseLocation,
  type Forecast,
  type GeoLocation,
} from '@/api/weather';
import { useLocalStorage } from './useLocalStorage';

const STORAGE_KEY = 'weather-location-v1';
/** Halden, Norway — fallback when geolocation is denied or unavailable. */
const DEFAULT_LOCATION: GeoLocation = {
  latitude: 59.1296,
  longitude: 11.3879,
  name: 'Halden',
  country: 'Norge',
};

/**
 * Manages the user's saved weather location and the live forecast for it.
 *
 * Resolution order:
 *   1. localStorage (a previously chosen city) — used immediately
 *   2. Browser geolocation, on first mount only — overrides if granted
 *   3. Default Halden — used if neither is available
 *
 * The forecast itself is cached by react-query (10 min staleTime).
 */
export function useWeather() {
  const [location, setLocation] = useLocalStorage<GeoLocation>(
    STORAGE_KEY,
    DEFAULT_LOCATION
  );
  const [didTryGeo, setDidTryGeo] = useState(false);

  // Try the browser's geolocation API once on mount, only if the user
  // hasn't already saved a custom location. We don't prompt every time —
  // once they pick a city or accept geolocation, we trust the saved
  // value forever (until manually changed).
  useEffect(() => {
    if (didTryGeo) return;
    setDidTryGeo(true);
    // Skip if the user has already explicitly chosen something other
    // than the default Halden fallback.
    if (location.name !== DEFAULT_LOCATION.name) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const reverse = await reverseLocation(pos.coords.latitude, pos.coords.longitude);
        if (reverse) setLocation(reverse);
      },
      () => {
        /* permission denied — keep the Halden default */
      },
      { timeout: 8000, maximumAge: 600_000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const query = useQuery<Forecast>({
    queryKey: ['weather', location.latitude, location.longitude],
    queryFn: () => fetchForecast(location.latitude, location.longitude),
    staleTime: 10 * 60_000, // 10 minutes
    gcTime: 30 * 60_000,
  });

  return {
    location,
    setLocation,
    forecast: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}
