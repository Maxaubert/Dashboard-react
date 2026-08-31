import type { WishlistGame } from '../../src/api/types.js';

export interface WishlistEnv {
  steamKey: string;
  steamId: string;
  itadKey: string;
}

const ATL_SINCE = '2013-01-01T00:00:00Z';

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

export async function buildWishlist(
  env: WishlistEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<WishlistGame[]> {
  // Step 1: GetWishlist -> items[]. A failed or unparseable response throws so
  // the caller can serve its stale cache instead of caching an empty list.
  const items = await fetchWishlistItems(env, fetchImpl);

  if (items.length === 0) return [];

  // Build lookup map: appid (string) -> wishlist metadata
  const itemMap: Record<string, WishlistItem> = {};
  for (const i of items) {
    itemMap[String(i.appid)] = i;
  }

  // Step 2: For each appid: appdetails?appids=<id>&cc=no&filters=basic,price_overview,genres
  const appids = Object.keys(itemMap);
  const prices: Record<string, Record<string, unknown>> = {};
  for (const appid of appids) {
    try {
      const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=no&filters=basic,price_overview,genres`;
      const res = await fetchImpl(url);
      const pdata = (await res.json()) as Record<string, { success?: boolean; data?: Record<string, unknown> }>;
      const info = pdata?.[appid] ?? {};
      if (info.success && info.data) {
        prices[appid] = info.data;
      }
    } catch {
      // continue on failure like the Python
    }
  }

  // Step 3: Map to WishlistGame with exactly the fields/shape the Python builds
  const games: WishlistGame[] = [];
  for (const [appid, wdata] of Object.entries(itemMap)) {
    const pd = prices[appid] ?? {};
    const po = (pd.price_overview ?? {}) as Record<string, unknown>;
    const genreList = ((pd.genres ?? []) as Array<{ description: string }>).map(
      (g) => g.description,
    );
    const discount = (po.discount_percent as number) ?? 0;
    const isFree = (pd.is_free as boolean) ?? false;
    const onSale = discount > 0 && !isFree;
    const price = !isFree ? ((po.final_formatted as string) ?? null) : null;
    const origPrice = onSale ? ((po.initial_formatted as string) ?? '') : '';
    const name = (pd.name as string) || wdata.appid?.toString() || '';
    const imgUrl =
      (pd.header_image as string) ||
      `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`;

    games.push({
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
    });
  }

  // Step 4: ITAD lookup -> itadId for each game (only if an ITAD key is configured)
  if (env.itadKey) {
    for (const g of games) {
      try {
        const url = `https://api.isthereanydeal.com/games/lookup/v1?key=${env.itadKey}&appid=${g.appid}`;
        const res = await fetchImpl(url);
        const data = (await res.json()) as { game?: { id?: string } };
        const gid = data?.game?.id ?? null;
        if (gid) g.itadId = gid;
      } catch { /* continue */ }
    }

    // Step 5: hot-tag on-sale games at their all-time low
    for (const g of games) {
      if (!g.onSale || !g.itadId) continue;
      try {
        const url = `https://api.isthereanydeal.com/games/history/v2?key=${env.itadKey}&id=${g.itadId}&shops=61&since=${ATL_SINCE}`;
        const res = await fetchImpl(url);
        const raw = await res.json();
        const cuts = (raw as Array<{ deal?: { cut: number } }>).filter((p) => p.deal).map((p) => p.deal!.cut);
        if (cuts.length > 0) {
          const bestCut = Math.max(...cuts);
          if (bestCut > 0 && g.discount >= bestCut - 5) g.priceTag = 'hot';
        }
      } catch { /* continue */ }
    }
  }

  // Step 6: Sort by (priority, name.toLowerCase())
  games.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });

  return games;
}
