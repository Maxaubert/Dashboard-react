import type { NewsItem } from './types';

export type NewsSource = 'vg' | 'nrk' | 'aftenposten';

/**
 * Thin client for `/api/news`. The function reads each publisher's RSS feed
 * (`api/_lib/news.ts`), caches it for five minutes and returns the items
 * already sliced to `count`. VG's feed (https://www.vg.no/rss/feed/) only
 * carries vg.no articles, so no client-side host filtering is done; the old
 * sister-site filter belonged to a front-page scraper that no longer exists.
 */
export const newsApi = {
  list: async (source: NewsSource = 'vg', count = 8): Promise<NewsItem[]> => {
    const res = await fetch(`/api/news?source=${source}&count=${count}`);
    return res.json();
  },
};
