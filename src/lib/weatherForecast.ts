/**
 * Pure helpers for the forecast row on the weather bento card.
 */

const DAY_SHORT = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];

/**
 * Column label for a forecast day: "I dag" for today, otherwise weekday
 * plus day.month with no zero padding ("Man 2.9", "Ons 30.12").
 *
 * `date` and `today` are Open-Meteo `YYYY-MM-DD` strings in the location's
 * local time; they are parsed at noon so a DST switch never shifts the day.
 */
export function forecastDayLabel(date: string, today?: string): string {
  if (today && date === today) return 'I dag';
  const dt = new Date(date + 'T12:00:00');
  if (Number.isNaN(dt.getTime())) return date;
  return `${DAY_SHORT[dt.getDay()]} ${dt.getDate()}.${dt.getMonth() + 1}`;
}
