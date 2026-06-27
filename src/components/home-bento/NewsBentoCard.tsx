import { useNews } from '@/hooks/useNews';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { NewsSource } from '@/api/news';
import type { NewsItem } from '@/api/types';
import { useBentoCarousel } from './useBentoCarousel';

const SOURCES: Array<{ value: NewsSource; label: string }> = [
  { value: 'vg', label: 'VG' },
  { value: 'nrk', label: 'NRK' },
  { value: 'aftenposten', label: 'AP' },
];

/** Nyhetssaker — horizontal row of news cards with a source switch. */
export function NewsBentoCard() {
  const [source, setSource] = useLocalStorage<NewsSource>('news-source', 'vg');
  const { data: news, isLoading, error } = useNews(source, 14);
  const scrollerRef = useBentoCarousel<HTMLDivElement>();

  return (
    <section className="bento-card area-news">
      <div className="ch">
        <h2>Nyhetssaker</h2>
        <div className="nswitch">
          {SOURCES.map((s) => (
            <button
              key={s.value}
              type="button"
              className={s.value === source ? 'on' : ''}
              onClick={() => setSource(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="nscroll" ref={scrollerRef}>
        {isLoading ? (
          <div className="news-msg">Laster nyheter…</div>
        ) : error ? (
          <div className="news-msg">Kunne ikke laste nyheter.</div>
        ) : (news?.length ?? 0) === 0 ? (
          <div className="news-msg">Ingen nyheter.</div>
        ) : (
          news?.map((item, i) => <NewsCard key={i} item={item} />)
        )}
      </div>
    </section>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a href={item.link} target="_blank" rel="noreferrer noopener" className="ncard">
      {item.img && <img src={item.img} alt="" loading="lazy" />}
      <div className="ng" />
      <div className="nt">{item.title}</div>
    </a>
  );
}
