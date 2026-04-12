import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  SPORT_DATA,
  STREAMS,
  getSources,
  resolveUrl,
  type SportCategory,
  type SportEvent,
  type SourceKey,
} from '@/data/sportsData';
import { cn } from '@/lib/cn';

type FilterKey = 'all' | SportCategory;

const FILTERS: Array<{ key: FilterKey; label: string; icon: React.ReactNode }> = [
  {
    key: 'all',
    label: 'Vis alt',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
  },
  {
    key: 'cross_country',
    label: 'Langrenn',
    icon: (
      <svg width="14" height="14" viewBox="0 0 576 512" fill="currentColor">
        <path d="M336 96a48 48 0 1 0 0-96a48 48 0 1 0 0 96m-108.8 64c1.9 0 3.8.1 5.6.3L201.6 254c-9.3 28 1.7 58.8 26.8 74.5l86.2 53.9l-23.3 81.6h-88.5l41.1-88.1l-32.4-20.3c-7.8-4.9-14.7-10.7-20.6-17.3L132.2 464H99.8L154 206.4c4.6-1.5 9-4.1 12.7-7.8l23.1-23.1c9.9-9.9 23.4-15.5 37.5-15.5zm-105.8 38.6c.4.4.8.8 1.3 1.2L67 464H24c-13.3 0-24 10.7-24 24s10.7 24 24 24h480c39.8 0 72-32.2 72-72v-8c0-13.3-10.7-24-24-24s-24 10.7-24 24v8c0 13.3-10.7 24-24 24h-69.4l27.6-179.3c10.5-5.2 17.8-16.1 17.8-28.7c0-17.7-14.3-32-32-32h-21.3c-12.9 0-24.6-7.8-29.5-19.7l-6.3-15c-14.6-35.1-44.1-61.9-80.5-73.1l-48.7-15C250.6 97.8 239 96 227.3 96c-31 0-60.8 12.3-82.7 34.3l-23.1 23.1c-12.5 12.5-12.5 32.8 0 45.3z" />
      </svg>
    ),
  },
  {
    key: 'biathlon',
    label: 'Skiskyting',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.88 3.64c.77 0 1.4.63 1.4 1.4s-.63 1.4-1.4 1.4s-1.38-.63-1.38-1.4s.61-1.4 1.38-1.4M15 13h1.5v6H15zm0-4.5h1.5V10H15zm-4.96-5.9L8 2.04L6.06 8.58L3.9 11.42l3.27.95zm9.63 15.95c-.36.38-.79.95-1.27 1.15c-.49.22-.86.3-1.4.3h-3.5l-.07-3c-.01-.17-.06-.33-.15-.5l-2.4-4.26l.88-2.74a246 246 0 0 0 1.3 2.33c.15.17.39.3.63.3h2.21a.81.81 0 0 0 .81-.81c0-.42-.33-.76-.75-.79l-1.67-.13L12.4 7s-.4-.58-1.26-.58c-.87 0-1.14.42-1.31 1L6 20H3v2h14c1.37 0 2.53-.66 3.5-1.63zm-9.92-4.16l1.87 3l.13 2.61h-4z" />
      </svg>
    ),
  },
  {
    key: 'football',
    label: 'Fotball',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2c0 5.5-5.5 10-10 10M12 2c0 5.5 5.5 10 10 10M12 22c0-5.5-5.5-10-10-10M12 22c0-5.5 5.5-10 10-10" />
      </svg>
    ),
  },
];

const CATEGORY_BADGE: Record<SportCategory, { cls: string; label: string }> = {
  cross_country: { cls: 'cc', label: 'Langrenn' },
  biathlon:      { cls: 'bi', label: 'Skiskyting' },
  football:      { cls: 'fb', label: 'Fotball' },
};

const CHANNEL_BADGE_CLASS: Record<string, string> = {
  'NRK':       'nrk',
  'TV 2':      'tv2',
  'Viaplay':   'viaplay',
  'NRK Radio': 'nrkradio',
  'TWE':       'twe',
};

const DAY_NAMES = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];
const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];

function localDateStr(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(dateStr: string): { label: string; cls: string } {
  if (dateStr === localDateStr(0)) return { label: 'I dag', cls: 'today' };
  if (dateStr === localDateStr(1)) return { label: 'I morgen', cls: 'tomorrow' };
  const d = new Date(dateStr + 'T12:00:00');
  return {
    label: `${DAY_NAMES[d.getDay()]} ${d.getDate()}. ${MONTHS[d.getMonth()]}`,
    cls: '',
  };
}

function isLive(event: SportEvent, nowSec: number): boolean {
  return nowSec >= event.timestamp && nowSec <= event.timestamp + 7200;
}
function isPast(event: SportEvent, nowSec: number): boolean {
  return event.timestamp + 10800 < nowSec;
}

function channelBadgeList(channel: string): Array<{ key: string; cls: string }> {
  return channel
    .split(' + ')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => ({ key: s, cls: CHANNEL_BADGE_CLASS[s] ?? 'nrk' }));
}

export function SportPage() {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [showPast, setShowPast] = useState(false);
  const [modalEvent, setModalEvent] = useState<SportEvent | null>(null);

  const nowSec = Math.floor(Date.now() / 1000);
  const threeDaysAgo = nowSec - 3 * 24 * 3600;

  const filteredEvents = useMemo(
    () => SPORT_DATA.events.filter((e) => filter === 'all' || e.category === filter),
    [filter]
  );
  const liveEvents = filteredEvents.filter((e) => isLive(e, nowSec));
  const upcomingEvents = filteredEvents.filter(
    (e) => !isLive(e, nowSec) && !isPast(e, nowSec)
  );
  const pastEvents = filteredEvents
    .filter((e) => isPast(e, nowSec) && e.timestamp >= threeDaysAgo)
    .sort((a, b) => b.timestamp - a.timestamp);

  // Group upcoming by date
  const grouped = useMemo(() => {
    const map = new Map<string, SportEvent[]>();
    for (const e of upcomingEvents) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [upcomingEvents]);

  function handleEventClick(event: SportEvent) {
    const sources = getSources(event);
    if (sources.length === 0) return;
    if (sources.length === 1) {
      window.open(resolveUrl(sources[0], event), '_blank', 'noopener');
      return;
    }
    setModalEvent(event);
  }

  return (
    <div className="sport-page">
      <div className="sport-title-desktop">
        <span className="sport-title-main">Sport</span>
        <div className="sport-last-updated">
          <span className="sport-live-dot">
            <svg width="8" height="8" viewBox="0 0 8 8">
              <circle cx="4" cy="4" r="4" fill="currentColor" />
            </svg>
          </span>
          <span>Oppdatert {SPORT_DATA.lastUpdated}</span>
        </div>
      </div>

      <div className="sport-filters">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={cn('sport-filter-btn', filter === f.key && 'active')}
            onClick={() => setFilter(f.key)}
          >
            {f.icon}
            {f.label}
          </button>
        ))}
        {pastEvents.length > 0 && (
          <button
            className={cn('sport-past-btn', showPast && 'active')}
            onClick={() => setShowPast((s) => !s)}
          >
            Vis tidligere
          </button>
        )}
      </div>

      {/* Live now */}
      {liveEvents.length > 0 && (
        <div className="live-now-section">
          <div className="live-now-header">
            <span className="live-pulse" />
            <span className="live-now-label">Direkte nå</span>
          </div>
          <div className="events-grid">
            {liveEvents.map((e) => (
              <EventCard key={e.idx} event={e} live onClick={() => handleEventClick(e)} />
            ))}
          </div>
        </div>
      )}

      {/* Past (collapsed by default) */}
      {showPast && pastEvents.length > 0 && (
        <div style={{ marginBottom: 24, opacity: 0.55 }}>
          <div className="date-label">Tidligere</div>
          <div className="events-grid">
            {pastEvents.map((e) => (
              <EventCard key={e.idx} event={e} onClick={() => handleEventClick(e)} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming, grouped by date */}
      {grouped.length === 0 && liveEvents.length === 0 ? (
        <div className="sport-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <p>Ingen kommende sendinger.</p>
        </div>
      ) : (
        grouped.map(([date, events]) => {
          const { label, cls } = formatDateLabel(date);
          return (
            <div key={date} className="date-group">
              <div className={cn('date-label', cls)}>
                {label}
                {cls === 'today' && <span className="date-badge">I DAG</span>}
              </div>
              <div className="events-grid">
                {events.map((e) => (
                  <EventCard key={e.idx} event={e} onClick={() => handleEventClick(e)} />
                ))}
              </div>
            </div>
          );
        })
      )}

      <SourceModal event={modalEvent} onClose={() => setModalEvent(null)} />
    </div>
  );
}

/* ── Event card ──────────────────────────────────────────────────────────── */
function EventCard({
  event,
  live,
  onClick,
}: {
  event: SportEvent;
  live?: boolean;
  onClick: () => void;
}) {
  const cat = CATEGORY_BADGE[event.category];
  const channels = channelBadgeList(event.channel);

  return (
    <div className={cn('event-card', event.category, live && 'live')} onClick={onClick}>
      <div className="event-time">
        <div className="event-start">{event.startTime}</div>
      </div>
      <div className="event-body">
        <div className="event-title">{event.title}</div>
        <div className="event-meta">
          {live && <span className="sport-badge live">● Direkte</span>}
          <span className={cn('sport-badge', cat.cls)}>{cat.label}</span>
          {channels.map((c) => (
            <span key={c.key} className={cn('sport-badge', c.cls)}>
              {c.key}
            </span>
          ))}
        </div>
      </div>
      <svg className="event-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>
  );
}

/* ── Source picker modal — sport's distinct 340px style ─────────────────── */
function SourceModal({ event, onClose }: { event: SportEvent | null; onClose: () => void }) {
  if (!event) return null;
  const sources = getSources(event);

  return (
    <Dialog.Root open={!!event} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="sport-modal-overlay" />
        <Dialog.Content className="sport-modal">
          <Dialog.Close asChild>
            <button className="sport-modal-close" aria-label="Lukk">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </Dialog.Close>
          <div className="sport-modal-label">Se sending</div>
          <Dialog.Title className="sport-modal-title">{event.title}</Dialog.Title>
          <Dialog.Description className="sr-only">Velg en sending å spille av</Dialog.Description>
          <div className="sport-modal-sources">
            {sources.map((s) => (
              <SourceLink key={s} source={s} url={resolveUrl(s, event)} />
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const SOURCE_TONE: Record<SourceKey, string> = {
  'NRK':       'nrk',
  'TV 2':      'tv2',
  'Viaplay':   'viaplay',
  'NRK Radio': 'radio',
  'TWE':       'twe',
};

function SourceLink({ source, url }: { source: SourceKey; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className={cn('source-btn', SOURCE_TONE[source])}
    >
      <span className="src-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
        </svg>
      </span>
      <span className="src-name">{STREAMS[source].label}</span>
      <svg className="src-ext" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  );
}
