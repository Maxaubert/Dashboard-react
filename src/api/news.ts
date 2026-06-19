import type { NewsItem } from './types';

export type NewsSource = 'vg' | 'nrk' | 'aftenposten';

/**
 * VG promotes articles from their sister sites (vektklubb, godt, e24, etc.)
 * on the front page. The api.py VG scraper picks up every URL in VG's
 * itemListElement, so the response includes those cross-promotions. We
 * filter to vg.no only so the "Nyhetssaker -- VG" section actually shows
 * VG articles. NRK and Aftenposten use proper RSS feeds so no filter
 * is needed for them.
 */
function isVgArticle(item: NewsItem): boolean {
  try {
    const host = new URL(item.link).hostname.replace(/^www\./, '');
    return host === 'vg.no';
  } catch {
    return false;
  }
}

export const newsApi = {
  list: async (source: NewsSource = 'vg', count = 8): Promise<NewsItem[]> => {
    if (source === 'vg') {
      // Fetch a few extra so the post-filter list still has roughly the
      // requested count even if VG is featuring lots of sister-site content.
      const res = await fetch(`/api/news?source=${source}&count=${count + 6}`);
      const items: NewsItem[] = await res.json();
      return items.filter(isVgArticle).slice(0, count);
    }
    // NRK + Aftenposten use RSS feeds, no filtering needed
    const res = await fetch(`/api/news?source=${source}&count=${count}`);
    return res.json();
  },
};
