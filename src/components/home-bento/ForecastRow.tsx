import { describeWeather, type DailyForecast } from '@/api/weather';
import { useDragScroll } from '@/hooks/useDragScroll';
import { forecastDayLabel } from '@/lib/weatherForecast';
import { iconForCode } from '@/lib/weatherIcons';
import { WeatherIcon } from './WeatherIcon';

/**
 * Horizontal, drag-scrollable row of forecast days. Fixed 74px columns (8px
 * gap); the first ~4 fit the card, the rest are reached by dragging (mouse,
 * with inertia), trackpad, or arrow keys once focused. The row is free
 * scrolling, so releasing a drag leaves it exactly where it landed.
 *
 * The scroller is a focusable region wrapping a real list, so screen
 * readers get a named scroll region plus a 14-item list rather than a
 * focusable list.
 */
export function ForecastRow({ days }: { days: DailyForecast[] }) {
  const ref = useDragScroll<HTMLDivElement>();
  const today = days[0]?.date;

  return (
    <div ref={ref} className="fc" role="region" aria-label="Varsel for de neste dagene" tabIndex={0}>
      <ul className="fc-track" role="list">
        {days.map((d) => {
          const label = forecastDayLabel(d.date, today);
          const { label: condition } = describeWeather(d.weatherCode);
          const max = Math.round(d.tempMax);
          const min = Math.round(d.tempMin);
          return (
            <li
              key={d.date}
              className="fc-col"
              aria-label={`${label}: ${condition}, ${max} til ${min} grader`}
            >
              <div className="d">{label}</div>
              <div className="fc-ic">
                <WeatherIcon icon={iconForCode(d.weatherCode)} />
              </div>
              <div className="fc-temps">
                <strong>{max}&deg;</strong>
                <span>{min}&deg;</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
