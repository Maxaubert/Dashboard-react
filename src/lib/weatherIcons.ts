/**
 * WMO weather code -> icon key for the bento forecast row.
 *
 * The icon set is intentionally small (nine glyphs) so every column of the
 * forecast row is drawn in one stroke weight and sits on the same baseline.
 * Reference: https://open-meteo.com/en/docs (weather_code table).
 */

export type WeatherIconKey =
  | 'sun'
  | 'moon'
  | 'partly'
  | 'cloud'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'thunder';

export const WEATHER_ICON_KEYS: readonly WeatherIconKey[] = [
  'sun',
  'moon',
  'partly',
  'cloud',
  'fog',
  'drizzle',
  'rain',
  'snow',
  'thunder',
];

/**
 * Pick the icon for a WMO code. Clear and mostly-clear skies swap the sun
 * for a moon at night; a partly cloudy night reads as plain cloud because
 * the set has no moon-behind-cloud glyph.
 */
export function iconForCode(code: number, isDay = true): WeatherIconKey {
  if (code === 0) return isDay ? 'sun' : 'moon';
  if (code === 1) return isDay ? 'partly' : 'moon';
  if (code === 2) return isDay ? 'partly' : 'cloud';
  if (code === 3) return 'cloud';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code >= 61 && code <= 67) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'rain';
  if (code === 85 || code === 86) return 'snow';
  if (code >= 95 && code <= 99) return 'thunder';
  return 'cloud';
}
