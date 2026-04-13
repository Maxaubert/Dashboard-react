import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PageHeader } from '@/components/layout/PageHeader';
import { useLinks } from '@/hooks/useLinks';
import { usePlan } from '@/hooks/usePlan';
import { useNews } from '@/hooks/useNews';
import { useWeather } from '@/hooks/useWeather';
import { useDragScroll } from '@/hooks/useDragScroll';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { searchLocation, describeWeather } from '@/api/weather';
import type { NewsSource } from '@/api/news';
import { LinkIconRender } from './LinksPage';
import type { LinkItem, NewsItem, PlanItem } from '@/api/types';
import { cn } from '@/lib/cn';
import { WidgetsSection } from '@/components/widgets/WidgetsSection';

/* ── Drag handle ────────────────────────────────────────────────────────── */
type HandleProps = Record<string, unknown>;

function GripHandle({ handleProps }: { handleProps?: HandleProps }) {
  return (
    <span className="db-grip-handle" {...handleProps}>
      <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
        <circle cx="2" cy="2" r="1.5" />
        <circle cx="8" cy="2" r="1.5" />
        <circle cx="2" cy="7" r="1.5" />
        <circle cx="8" cy="7" r="1.5" />
        <circle cx="2" cy="12" r="1.5" />
        <circle cx="8" cy="12" r="1.5" />
      </svg>
    </span>
  );
}

/* ── Section ordering ───────────────────────────────────────────────────── */
const SECTION_IDS = [
  'kategorier',
  'widgets',
  'ext-lenker',
  'dagens-plan',
  'vaer',
  'nyhetssaker',
] as const;
type SectionId = (typeof SECTION_IDS)[number];

const DAY_NO = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
const MON_NO = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];

/**
 * Home page — faithful port of the legacy index.html.
 *
 * Sections (in order):
 *   1. Kategorier — 5 category cards (Plan, Skole, Notater, Sport, Gaming)
 *   2. Eksterne lenker — favourites carousel with "Alle" link to /links
 *   3. Dagens plan — today's events from /api/plan
 *   4. Nyhetssaker — VG news cards from /api/news
 */
export function HomePage() {
  // Persist the section order so the user's preference survives reloads.
  // Validate against SECTION_IDS so a stale order from an older schema
  // doesn't drop or duplicate sections.
  const [storedOrder, setStoredOrder] = useLocalStorage<SectionId[]>(
    'home-section-order',
    [...SECTION_IDS]
  );
  const order = useMemo<SectionId[]>(() => {
    const known = (storedOrder ?? []).filter((id): id is SectionId =>
      (SECTION_IDS as readonly string[]).includes(id)
    );
    const missing = SECTION_IDS.filter((id) => !known.includes(id));
    return [...known, ...missing];
  }, [storedOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = order.indexOf(active.id as SectionId);
    const newIdx = order.indexOf(over.id as SectionId);
    if (oldIdx < 0 || newIdx < 0) return;
    setStoredOrder(arrayMove(order, oldIdx, newIdx));
  }

  return (
    <div className="page">
      <PageHeader eyebrow="Hjem" title="Dashboard" subtitle="Velg en kategori" />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="sections-container">
            {order.map((id) => (
              <SortableHomeSection key={id} id={id} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

/**
 * Wraps a single home section in a dnd-kit sortable container. Renders
 * the appropriate section component based on `id` and threads the drag
 * handle props down so the grip icon (and ONLY the grip icon) initiates
 * the drag — clicking anywhere else in the section still works normally.
 */
function SortableHomeSection({ id }: { id: SectionId }) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const handleProps: HandleProps = { ...attributes, ...(listeners ?? {}) };

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && 'db-section-dragging')}>
      {id === 'kategorier' && <KategorierSection handleProps={handleProps} />}
      {id === 'widgets' && <WidgetsSection handleProps={handleProps} />}
      {id === 'ext-lenker' && <EksterneLenkerSection handleProps={handleProps} />}
      {id === 'dagens-plan' && <DagensPlanSection handleProps={handleProps} />}
      {id === 'vaer' && <VaerSection handleProps={handleProps} />}
      {id === 'nyhetssaker' && <NyhetssakerSection handleProps={handleProps} />}
    </div>
  );
}

// ─── Kategorier ──────────────────────────────────────────────────────────

interface CategoryDef {
  to: string;
  label: string;
  desc: string;
  variant: 'plan' | 'skole' | 'notater' | 'sport' | 'gaming';
  icon: React.ReactNode;
}

const CATEGORIES: CategoryDef[] = [
  {
    to: '/plan',
    label: 'Plan',
    desc: 'Ukeplan og timeplan',
    variant: 'plan',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 3h-1V1h-2v2H8V1H6v2H5C3.9 3 3 3.9 3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" />
      </svg>
    ),
  },
  {
    to: '/skole',
    label: 'Skole',
    desc: 'Fag og innleveringer',
    variant: 'skole',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" />
      </svg>
    ),
  },
  {
    to: '/notes',
    label: 'Notater',
    desc: 'Egne notater',
    variant: 'notater',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 18h12v-2H3v2zm0-5h12v-2H3v2zm0-7v2h12V6H3zm14 9.34V7h-2v11.34l1 .66 1-.66z" />
      </svg>
    ),
  },
  {
    to: '/sport',
    label: 'Sport',
    desc: 'Sendinger og resultater',
    variant: 'sport',
    icon: (
      <svg width="16" height="16" viewBox="0 0 576 512" fill="currentColor">
        <path d="M336 96a48 48 0 1 0 -96 0 48 48 0 1 0 96 0zM244.6 144.4c-9.2-3.4-16.9-9.6-22-17.6l-147-147c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c6 6 14.1 9.3 22.6 9.3l64.1 0zM224 256l0 128-64 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l128 0 128 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-64 0 0-128 0-50.7 129.5-129.5c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 158.6 266.6 137.3c3.5 8.1 5.4 17 5.4 26.3l0 32.7L224 196.9 224 256z" />
      </svg>
    ),
  },
  {
    to: '/gaming',
    label: 'Gaming',
    desc: 'Steam ønskeliste',
    variant: 'gaming',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21 6H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1zm-10 9H8v-3H5v-2h3V7h2v3h3v2h-3v3zm4.5 1a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-3a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
      </svg>
    ),
  },
];

function KategorierSection({ handleProps }: { handleProps?: HandleProps }) {
  return (
    <section>
      <div className="section-header">
        <span>
          <GripHandle handleProps={handleProps} />
          Kategorier
        </span>
      </div>
      <div className="cards-grid">
        {CATEGORIES.map((cat) => (
          <Link key={cat.to} to={cat.to} className={cn('card', cat.variant)}>
            <div className="card-icon">{cat.icon}</div>
            <div className="card-body">
              <div className="card-title">{cat.label}</div>
              <div className="card-desc">{cat.desc}</div>
            </div>
            <div className="card-arrow">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ─── Eksterne lenker (favourites carousel) ───────────────────────────────

function EksterneLenkerSection({ handleProps }: { handleProps?: HandleProps }) {
  const { data: envelope } = useLinks();
  const links = envelope?.links ?? [];
  const favorites = useMemo(
    () => links.filter((l: LinkItem) => l.favorite),
    [links]
  );

  // Render N copies of the favorites for infinite-loop scrolling. The
  // hook starts the user in the middle copy and snaps them by one copy
  // when they drift toward either edge. We need enough copies that the
  // total rendered width comfortably exceeds the viewport — when the
  // user has only a few favorites, that means rendering more copies, so
  // the wrap zone always has room. Targeting ~3500px of items ensures
  // wrap works on wide pages (1240px max) without going overboard.
  const copyCount = useMemo(() => {
    if (favorites.length === 0) return 0;
    const TARGET_WIDTH = 3500;
    const ESTIMATED_ITEM_W = 120;
    return Math.min(
      20,
      Math.max(5, Math.ceil(TARGET_WIDTH / (favorites.length * ESTIMATED_ITEM_W)))
    );
  }, [favorites.length]);

  const looped = useMemo(() => {
    if (favorites.length === 0) return [];
    return Array.from({ length: copyCount }, (_, c) =>
      favorites.map((l, i) => ({ ...l, _k: `${c}-${i}-${l.id}` }))
    ).flat();
  }, [favorites, copyCount]);

  const scrollerRef = useDragScroll<HTMLDivElement>({
    infinite: favorites.length > 0,
    copies: copyCount || 3,
  });

  return (
    <section>
      <div className="section-header">
        <span>
          <GripHandle handleProps={handleProps} />
          Eksterne lenker
        </span>
        <Link to="/links" className="section-header-link">
          Alle
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z" />
          </svg>
        </Link>
      </div>
      <div className="ext-grid-wrap">
        <div className="ext-grid" ref={scrollerRef}>
          {favorites.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem', padding: '8px 0' }}>
              Ingen favoritter
            </div>
          ) : (
            looped.map((link) => <ExternalLinkCard key={link._k} link={link} />)
          )}
        </div>
      </div>
    </section>
  );
}

function ExternalLinkCard({ link }: { link: LinkItem }) {
  const accent = link.color ?? 'var(--color-page-plan)';
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer noopener"
      className="ext-link"
      style={{ ['--ext-color' as string]: accent }}
    >
      <div className="ext-link-top">
        <div className="ext-link-icon-wrap">
          <LinkIconRender link={link} />
        </div>
        <svg
          className="ext-link-arrow"
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M14 3l-1.41 1.41L18.17 10H4v2h14.17l-5.58 5.59L14 19l8-8z" />
        </svg>
      </div>
      <div>
        <div className="ext-link-name">{link.name}</div>
        {link.sub && <div className="ext-link-sub">{link.sub}</div>}
      </div>
    </a>
  );
}

// ─── Dagens plan ─────────────────────────────────────────────────────────

function DagensPlanSection({ handleProps }: { handleProps?: HandleProps }) {
  const { data: plan } = usePlan();

  const now = new Date();
  const todayDow = (now.getDay() + 6) % 7; // 0=Mon..6=Sun
  const todayIso = now.toISOString().slice(0, 10);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const dateLabel = `${DAY_NO[todayDow]} ${now.getDate()}. ${MON_NO[now.getMonth()]}`;

  const todays = useMemo(() => {
    if (!plan) return [];
    return plan
      .filter((ev) => {
        if (ev.recurring) return ev.days?.includes(todayDow) ?? false;
        return ev.date === todayIso;
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [plan, todayDow, todayIso]);

  return (
    <section>
      <div className="section-header">
        <span>
          <GripHandle handleProps={handleProps} />
          Dagens plan
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
          {dateLabel}
        </span>
      </div>
      <div className="today-list">
        {todays.length === 0 ? (
          <div className="today-empty">Ingen hendelser i dag.</div>
        ) : (
          todays.map((ev) => <TodayItem key={ev.id} event={ev} nowMin={nowMin} />)
        )}
      </div>
    </section>
  );
}

function TodayItem({ event, nowMin }: { event: PlanItem; nowMin: number }) {
  const parseMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const start = parseMin(event.startTime);
  const end = parseMin(event.endTime);
  const past = end < nowMin;
  const active = start <= nowMin && nowMin < end;

  return (
    <div className={cn('today-item', past && 'past')}>
      <Link to="/plan" className="today-item-inner">
        <div className="today-dot" style={{ background: event.color || '#888' }} />
        <span className="today-time">
          {event.startTime}–{event.endTime}
        </span>
        <span className="today-title">{event.title}</span>
        {event.location && <span className="today-loc">{event.location}</span>}
        {active && <span className="today-now-badge">Nå</span>}
      </Link>
    </div>
  );
}

// ─── Vær (Open-Meteo) ────────────────────────────────────────────────────

function VaerSection({ handleProps }: { handleProps?: HandleProps }) {
  const { location, setLocation, forecast, isLoading, error } = useWeather();
  const [editing, setEditing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchError, setSearchError] = useState('');

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchError('');
    const hit = await searchLocation(searchInput);
    if (!hit) {
      setSearchError('Fant ingen sted');
      return;
    }
    setLocation(hit);
    setEditing(false);
    setSearchInput('');
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

// ─── Nyhetssaker (VG / NRK / Aftenposten) ────────────────────────────────

const NEWS_SOURCES: Array<{ value: NewsSource; label: string }> = [
  { value: 'vg', label: 'VG' },
  { value: 'nrk', label: 'NRK' },
  { value: 'aftenposten', label: 'Aftenposten' },
];

function NyhetssakerSection({ handleProps }: { handleProps?: HandleProps }) {
  const [source, setSource] = useLocalStorage<NewsSource>('news-source', 'vg');
  const { data: news, isLoading, error } = useNews(source, 14);
  const scrollerRef = useDragScroll<HTMLDivElement>(); // inertia, not infinite

  return (
    <section>
      <div className="section-header">
        <span>
          <GripHandle handleProps={handleProps} />
          Nyhetssaker
        </span>
        <NewsSourceDropdown value={source} onChange={setSource} />
      </div>
      <div className="news-wrap">
        <div className="news-list" ref={scrollerRef}>
          {isLoading ? (
            <div className="news-loading">Laster nyheter…</div>
          ) : error ? (
            <div className="news-loading">Kunne ikke laste nyheter.</div>
          ) : (
            news?.map((item, i) => <NewsCard key={i} item={item} />)
          )}
        </div>
      </div>
    </section>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a href={item.link} target="_blank" rel="noreferrer noopener" className="news-item">
      {item.img && (
        <div className="news-img">
          <img src={item.img} alt="" loading="lazy" />
        </div>
      )}
      <div className="news-overlay" />
      <div className="news-title">{item.title}</div>
    </a>
  );
}

/**
 * Custom dropdown for picking the news source. Replaces a native <select>
 * because Win11 renders <option> lists with rounded pill items inside a
 * lighter container, which clashes with the dashboard's flat dark theme
 * and isn't restyleable cross-browser.
 */
function NewsSourceDropdown({
  value,
  onChange,
}: {
  value: NewsSource;
  onChange: (v: NewsSource) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape so the popover behaves like a real menu.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = NEWS_SOURCES.find((s) => s.value === value);

  return (
    <div className="news-source-dropdown" ref={ref}>
      <button
        type="button"
        className="news-source-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current?.label ?? value.toUpperCase()}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </button>
      {open && (
        <div className="news-source-menu" role="listbox">
          {NEWS_SOURCES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="option"
              aria-selected={s.value === value}
              className={cn('news-source-option', s.value === value && 'active')}
              onClick={() => {
                onChange(s.value);
                setOpen(false);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
