/**
 * IsThereAnyDeal price history fetch + chart builder.
 *
 * Ported verbatim from gaming.html so the price chart looks identical.
 * The ITAD API is public; the API key is shared with the legacy site.
 */

const ITAD_KEY = 'bbb182d083a1e9a41190660669883e05d133cca2';
const MONTHS_NB = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des'];

export interface HistoryPoint {
  /** Unix ms timestamp. */
  t: number;
  /** Price in NOK (rounded). */
  price: number;
  /** Discount cut at this point in time, 0-100. */
  cut: number;
}

let _eurNok: number | null = null;

async function getEurNok(): Promise<number> {
  if (_eurNok !== null) return _eurNok;
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=EUR&to=NOK');
    const json = await res.json();
    _eurNok = json.rates?.NOK ?? 11.5;
  } catch {
    _eurNok = 11.5;
  }
  return _eurNok ?? 11.5;
}

/**
 * Fetches the last 6 months of price history for an ITAD game id and
 * returns it sorted oldest-first with prices converted to NOK.
 */
export async function fetchItadHistory(itadId: string): Promise<HistoryPoint[]> {
  const since = new Date(Date.now() - 182 * 86_400_000).toISOString().replace(/\.\d+Z$/, 'Z');
  const url = `https://api.isthereanydeal.com/games/history/v2?key=${ITAD_KEY}&id=${itadId}&shops=61&since=${since}`;
  const [res, nokRate] = await Promise.all([fetch(url), getEurNok()]);
  if (!res.ok) throw new Error(String(res.status));
  const raw = (await res.json()) as Array<{
    timestamp: string;
    deal?: { price: { amount: number }; cut: number };
  }>;
  return raw
    .filter((p) => !!p.deal)
    .map((p) => ({
      t: new Date(p.timestamp).getTime(),
      price: Math.round((p.deal!.price.amount * nokRate)),
      cut: p.deal!.cut,
    }))
    .reverse();
}

/**
 * Builds the same SVG line chart as the legacy gaming.html.
 * Returns an SVG string that should be set via dangerouslySetInnerHTML
 * (the SVG generation is identical to legacy so dom diffing isn't worth it).
 */
export function buildLineChartSvg(pts: HistoryPoint[]): string {
  const W = 500;
  const H = 180;
  const P = { t: 16, r: 16, b: 32, l: 58 };
  const pw = W - P.l - P.r;
  const ph = H - P.t - P.b;

  // Extend final point to "now" so the line stretches all the way right.
  const now = Date.now();
  const last = pts[pts.length - 1];
  const all = [...pts, { t: now, price: last.price, cut: last.cut }];

  const minT = all[0].t;
  const maxT = now;
  const prices = all.map((p) => p.price);
  const minP = Math.max(0, Math.min(...prices) * 0.88);
  const maxP = Math.max(...prices) * 1.08;

  const X = (t: number) => P.l + ((t - minT) / (maxT - minT)) * pw;
  const Y = (p: number) => P.t + (1 - (p - minP) / (maxP - minP)) * ph;

  // Step-shape path: horizontal then vertical at each transition.
  let linePath = '';
  for (let i = 0; i < all.length - 1; i++) {
    const x0 = X(all[i].t);
    const x1 = X(all[i + 1].t);
    const y0 = Y(all[i].price);
    const y1 = Y(all[i + 1].price);
    linePath += `M${x0},${y0} H${x1} M${x1},${y0} V${y1} `;
  }

  const cx = X(now);
  const cy = Y(all[all.length - 1].price);

  // Y-axis grid + price labels (5 lines)
  let yLines = '';
  for (let i = 0; i <= 4; i++) {
    const p = minP + ((maxP - minP) * i) / 4;
    const y = Y(p);
    yLines += `<line x1="${P.l}" y1="${y}" x2="${P.l + pw}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`;
    yLines += `<text x="${P.l - 7}" y="${y + 4}" text-anchor="end" font-size="10" fill="#4a4a4a">${Math.round(p)} kr</text>`;
  }

  // X-axis month labels — step varies by total span
  let xLines = '';
  const spanMs = maxT - minT;
  const mo = 30 * 86_400_000;
  const step = spanMs > 18 * mo ? 6 : spanMs > 8 * mo ? 3 : 1;
  const d0 = new Date(minT);
  d0.setDate(1);
  d0.setMonth(d0.getMonth() + 1);
  for (let d = new Date(d0); d.getTime() < maxT; d.setMonth(d.getMonth() + step)) {
    const x = X(d.getTime());
    if (x < P.l + 10 || x > P.l + pw - 10) continue;
    const lbl = step >= 6
      ? `${MONTHS_NB[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
      : MONTHS_NB[d.getMonth()];
    xLines += `<line x1="${x}" y1="${P.t}" x2="${x}" y2="${P.t + ph}" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>`;
    xLines += `<text x="${x}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#4a4a4a">${lbl}</text>`;
  }

  // All-time-low marker (dashed yellow line)
  const atl = Math.min(...prices);
  const atlY = Y(atl);
  const atlLine = `<line x1="${P.l}" y1="${atlY}" x2="${P.l + pw}" y2="${atlY}" stroke="rgba(250,204,21,0.4)" stroke-width="1" stroke-dasharray="4,3"/>
    <text x="${P.l + 4}" y="${atlY - 4}" font-size="9" fill="rgba(250,204,21,0.6)">ATL ${Math.round(atl)} kr</text>`;

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
    ${yLines}${xLines}${atlLine}
    <path d="${linePath}" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="${cx}" cy="${cy}" r="4" fill="#4ade80" stroke="#111" stroke-width="2"/>
  </svg>`;
}
