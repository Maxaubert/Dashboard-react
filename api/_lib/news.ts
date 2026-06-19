import { XMLParser } from 'fast-xml-parser';
import type { NewsItem } from '../../src/api/types';

const FEEDS: Record<string, string> = {
  vg: 'https://www.vg.no/rss/feed/',
  nrk: 'https://www.nrk.no/toppsaker.rss',
  aftenposten: 'https://www.aftenposten.no/rss',
};

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

export function parseRss(xml: string): NewsItem[] {
  const doc = parser.parse(xml) as { rss?: { channel?: { item?: unknown } } };
  const raw = doc?.rss?.channel?.item ?? [];
  const items = Array.isArray(raw) ? raw : [raw];
  return items.map((it: Record<string, unknown>) => {
    const enclosure = it.enclosure as { '@_url'?: string } | undefined;
    const media = it['media:content'] as { '@_url'?: string } | undefined;
    return {
      link: String(it.link ?? ''),
      title: String(it.title ?? '').trim(),
      desc: String(it.description ?? '').trim(),
      img: enclosure?.['@_url'] ?? media?.['@_url'] ?? '',
    };
  });
}

export async function fetchNews(source: keyof typeof FEEDS): Promise<NewsItem[]> {
  const url = FEEDS[source] ?? FEEDS.vg;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 DashboardBot' } });
  if (!res.ok) throw new Error(`feed ${source} ${res.status}`);
  return parseRss(await res.text());
}
