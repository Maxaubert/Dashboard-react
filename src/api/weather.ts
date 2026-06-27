/**
 * Weather API client — uses Open-Meteo (open-meteo.com).
 *
 * Why Open-Meteo:
 *   - Free, no API key required
 *   - CORS-enabled so the browser can fetch directly (no backend proxy)
 *   - Met.no's API requires a User-Agent header which the browser blocks
 *   - Includes both forecast and a free geocoding endpoint
 */

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const REVERSE_URL = 'https://geocoding-api.open-meteo.com/v1/reverse';

export interface GeoLocation {
  latitude: number;
  longitude: number;
  name: string; // city / locality
  country?: string;
  admin1?: string; // region / fylke
}

export interface DailyForecast {
  date: string; // YYYY-MM-DD
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipitation: number; // mm
  windSpeedMax: number;
  sunrise: string; // ISO local datetime, e.g. "2026-06-27T04:12"
  sunset: string; // ISO local datetime
}

export interface HourlyForecast {
  time: string; // ISO datetime, local time
  hour: number; // 0–23
  weatherCode: number;
  temperature: number;
}

export interface CurrentWeather {
  temperature: number;
  weatherCode: number;
  windSpeed: number;
  isDay: boolean;
}

export interface Forecast {
  current: CurrentWeather;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
}

/**
 * Fetch the 7-day forecast for a lat/lon. The response includes the
 * current conditions, hour-by-hour data for ~48 hours ahead, and
 * daily highs/lows for the next 7 days.
 */
export async function fetchForecast(lat: number, lon: number): Promise<Forecast> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,weather_code,wind_speed_10m,is_day',
    hourly: 'temperature_2m,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,sunrise,sunset',
    timezone: 'auto',
    forecast_days: '7',
  });
  const res = await fetch(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error(`weather: ${res.status}`);
  const json = await res.json();

  return {
    current: {
      temperature: json.current.temperature_2m,
      weatherCode: json.current.weather_code,
      windSpeed: json.current.wind_speed_10m,
      isDay: json.current.is_day === 1,
    },
    hourly: json.hourly.time.map((time: string, i: number) => ({
      time,
      // Open-Meteo returns ISO strings WITHOUT a timezone suffix when
      // timezone=auto, so the hour part is the local hour for `lat/lon`.
      // Slice it directly instead of letting Date() reinterpret it.
      hour: parseInt(time.slice(11, 13), 10),
      weatherCode: json.hourly.weather_code[i],
      temperature: json.hourly.temperature_2m[i],
    })),
    daily: json.daily.time.map((date: string, i: number) => ({
      date,
      weatherCode: json.daily.weather_code[i],
      tempMax: json.daily.temperature_2m_max[i],
      tempMin: json.daily.temperature_2m_min[i],
      precipitation: json.daily.precipitation_sum[i],
      windSpeedMax: json.daily.wind_speed_10m_max[i],
      sunrise: json.daily.sunrise[i],
      sunset: json.daily.sunset[i],
    })),
  };
}

/** Forward geocoding — search by city name, returns top match. */
export async function searchLocation(query: string): Promise<GeoLocation | null> {
  if (!query.trim()) return null;
  const params = new URLSearchParams({
    name: query.trim(),
    count: '1',
    language: 'no',
    format: 'json',
  });
  const res = await fetch(`${GEOCODING_URL}?${params}`);
  if (!res.ok) return null;
  const json = await res.json();
  const hit = json.results?.[0];
  if (!hit) return null;
  return {
    latitude: hit.latitude,
    longitude: hit.longitude,
    name: hit.name,
    country: hit.country,
    admin1: hit.admin1,
  };
}

/** Reverse geocoding — coords → place name (used after browser geolocation). */
export async function reverseLocation(lat: number, lon: number): Promise<GeoLocation | null> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    language: 'no',
    format: 'json',
  });
  try {
    const res = await fetch(`${REVERSE_URL}?${params}`);
    if (!res.ok) return null;
    const json = await res.json();
    const hit = json.results?.[0];
    if (!hit) return { latitude: lat, longitude: lon, name: 'Min posisjon' };
    return {
      latitude: lat,
      longitude: lon,
      name: hit.name,
      country: hit.country,
      admin1: hit.admin1,
    };
  } catch {
    return { latitude: lat, longitude: lon, name: 'Min posisjon' };
  }
}

/**
 * WMO weather code → short Norwegian description + emoji icon.
 * Reference: https://open-meteo.com/en/docs (Weather variable documentation)
 */
export function describeWeather(code: number): { label: string; icon: string } {
  if (code === 0) return { label: 'Klart', icon: '☀️' };
  if (code === 1) return { label: 'Mest klart', icon: '🌤' };
  if (code === 2) return { label: 'Delvis skyet', icon: '⛅' };
  if (code === 3) return { label: 'Skyet', icon: '☁️' };
  if (code === 45 || code === 48) return { label: 'Tåke', icon: '🌫' };
  if (code >= 51 && code <= 55) return { label: 'Yr', icon: '🌦' };
  if (code === 56 || code === 57) return { label: 'Underkjølt yr', icon: '🌧' };
  if (code >= 61 && code <= 65) return { label: 'Regn', icon: '🌧' };
  if (code === 66 || code === 67) return { label: 'Underkjølt regn', icon: '🌧' };
  if (code >= 71 && code <= 75) return { label: 'Snø', icon: '🌨' };
  if (code === 77) return { label: 'Snøkorn', icon: '🌨' };
  if (code >= 80 && code <= 82) return { label: 'Regnbyger', icon: '🌧' };
  if (code === 85 || code === 86) return { label: 'Snøbyger', icon: '🌨' };
  if (code === 95) return { label: 'Tordenvær', icon: '⛈' };
  if (code === 96 || code === 99) return { label: 'Torden m/ hagl', icon: '⛈' };
  return { label: 'Ukjent', icon: '❓' };
}
