import type { WishlistGame } from './types.js';
import type { CacheReader } from './cache.js';
import { mapWithConcurrency } from './pool.js';

export interface WishlistEnv {
  steamKey: string;
  steamId: string;
  itadKey: string;
}

const ATL_SINCE = '2013-01-01T00:00:00Z';

/** Upstream calls in flight per stage. Steam and ITAD both tolerate this. */
export const WISHLIST_CONCURRENCY = 8;

// ITAD game ids never change, so a hit can live for a long time. A miss is
// retried sooner: the game may simply not be in ITAD's catalogue yet.
export const ITAD_LOOKUP_HIT_TTL_MS = 30 * 24 * 60 * 60_000;
export const ITAD_LOOKUP_MISS_TTL_MS = 24 * 60 * 60_000;

/** Cache key for one appid -> ITAD id lookup. Shared across users. */
export function itadLookupKey(appid: string): string {
  return `itad:lookup:${appid}`;
}

interface ItadLookup {
  id: string | null;
}

export function itadLookupTtl(data: ItadLookup): number {
  return data.id ? ITAD_LOOKUP_HIT_TTL_MS : ITAD_LOOKUP_MISS_TTL_MS;
}

// Cache key for a user's Steam wishlist. Includes the linked Steam account so a
// re-link inside the TTL never serves the previous account's list.
export function wishlistCacheKey(userId: string, steamId: string): string {
  return `wishlist:${userId}:${steamId}`;
}

interface WishlistItem {
  appid: number;
  priority: number;
  date_added: number;
}

/** Default cache: no persistence, every lookup goes upstream. */
const passthroughCache: CacheReader = (_key, _ttl, fetcher) => fetcher();

async function fetchWishlistItems(env: WishlistEnv, fetchImpl: typeof fetch): Promise<WishlistItem[]> {
  const url = `https://api.steampowered.com/IWishlistService/GetWishlist/v1/?key=${env.steamKey}&steamid=${env.steamId}`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`steam wishlist ${res.status}`);
  let data: { response?: { items?: unknown } };
  try {
    data = (await res.json()) as typeof data;
  } catch (err) {
    throw new Error(`steam wishlist parse failure: ${err instanceof Error ? err.message : String(err)}`);
  }
  const items = data?.response?.items;
  if (items !== undefined && !Array.isArray(items)) {
    throw new Error('steam wishlist parse failure: items is not an array');
  }
  return (items ?? []) as WishlistItem[];
}

type AppDetails = Record<string, unknown>;

async function fetchAppDetails(appid: string, fetchImpl: typeof fetch): Promise<AppDetails | null> {
  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=no&filters=basic,price_overview,genres`;
    const res = await fetchImpl(url);
    const pdata = (await res.json()) as Record<string, { success?: boolean; data?: AppDetails }>;
    const info = pdata?.[appid] ?? {};
    return info.success && info.data ? info.data : null;
  } catch {
    return null; // one bad app must not sink the whole list
  }
}

async function fetchItadId(appid: string, itadKey: string, fetchImpl: typeof fetch): Promise<ItadLookup> {
  const url = `https://api.isthereanydeal.com/games/lookup/v1?key=${itadKey}&appid=${appid}`;
  const res = await fetchImpl(url);
  const data = (await res.json()) as { game?: { id?: string } };
  return { id: data?.game?.id ?? null };
}

async function fetchIsAllTimeLow(g: WishlistGame, itadKey: string, fetchImpl: typeof fetch): Promise<boolean> {
  try {
    const url = `https://api.isthereanydeal.com/games/history/v2?key=${itadKey}&id=${g.itadId}&shops=61&since=${ATL_SINCE}`;
    const res = await fetchImpl(url);
    const raw = await res.json();
    const cuts = (raw as Array<{ deal?: { cut: number } }>).filter((p) => p.deal).map((p) => p.deal!.cut);
    if (cuts.length === 0) return false;
    const bestCut = Math.max(...cuts);
    return bestCut > 0 && g.discount >= bestCut - 5;
  } catch {
    return false;
  }
}

function toWishlistGame(appid: string, wdata: WishlistItem, pd: AppDetails): WishlistGame {
  const po = (pd.price_overview ?? {}) as Record<string, unknown>;
  const genreList = ((pd.genres ?? []) as Array<{ description: string }>).map((g) => g.description);
  const discount = (po.discount_percent as number) ?? 0;
  const isFree = (pd.is_free as boolean) ?? false;
  const onSale = discount > 0 && !isFree;
  const price = !isFree ? ((po.final_formatted as string) ?? null) : null;
  const origPrice = onSale ? ((po.initial_formatted as string) ?? '') : '';
  const name = (pd.name as string) || wdata.appid?.toString() || '';
  const imgUrl =
    (pd.header_image as string) ||
    `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`;

  return {
    appid,
    name,
    imgUrl,
    imgFallback: `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`,
    storeUrl: `https://store.steampowered.com/app/${appid}/`,
    isFree,
    price,
    origPrice,
    discount,
    onSale,
    genres: genreList,
    priority: wdata.priority ?? 0,
    dateAdded: wdata.date_added ?? 0,
    priceInt: (po.final as number) ?? 0,
    currency: (po.currency as string) ?? 'NOK',
    priceTag: null,
    itadId: null,
  };
}

/**
 * Builds the enriched wishlist. Each per-game stage runs with bounded
 * concurrency and tolerates individual failures; only the initial GetWishlist
 * call throws, so the caller can serve its stale cache instead of an empty
 * list. `cache` persists appid -> ITAD id lookups between builds.
 */
export async function buildWishlist(
  env: WishlistEnv,
  fetchImpl: typeof fetch = fetch,
  cache: CacheReader = passthroughCache,
): Promise<WishlistGame[]> {
  // Step 1: GetWishlist -> items[].
  const items = await fetchWishlistItems(env, fetchImpl);
  if (items.length === 0) return [];

  const itemMap: Record<string, WishlistItem> = {};
  for (const i of items) itemMap[String(i.appid)] = i;
  const appids = Object.keys(itemMap);

  // Step 2: appdetails per app, bounded concurrency.
  const details = await mapWithConcurrency(appids, WISHLIST_CONCURRENCY, (appid) =>
    fetchAppDetails(appid, fetchImpl),
  );

  // Step 3: map to WishlistGame.
  const games = appids.map((appid, i) => toWishlistGame(appid, itemMap[appid], details[i] ?? {}));

  // Steps 4-5 only when an ITAD key is configured.
  if (env.itadKey) {
    // Step 4: ITAD id per game, served from the lookup cache when known.
    await mapWithConcurrency(games, WISHLIST_CONCURRENCY, async (g) => {
      try {
        const found = await cache(itadLookupKey(g.appid), itadLookupTtl, () =>
          fetchItadId(g.appid, env.itadKey, fetchImpl),
        );
        if (found.id) g.itadId = found.id;
      } catch { /* continue */ }
    });

    // Step 5: hot-tag on-sale games at their all-time low.
    const onSale = games.filter((g) => g.onSale && g.itadId);
    await mapWithConcurrency(onSale, WISHLIST_CONCURRENCY, async (g) => {
      if (await fetchIsAllTimeLow(g, env.itadKey, fetchImpl)) g.priceTag = 'hot';
    });
  }

  // Step 6: sort by (priority, name.toLowerCase()).
  games.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });

  return games;
}
