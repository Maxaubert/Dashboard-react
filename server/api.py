#!/usr/bin/env python3
"""
Dashboard API — pure Python 3, no external dependencies.
Runs on port 3001.
  GET  /api/todos        → read todos.json
  POST /api/todos        → write todos.json
  GET  /api/news         → fetch NRK top stories RSS and return JSON
"""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import json, os, re, tempfile, time
try:
    import fcntl as _fcntl  # POSIX only; not available on Windows
except ImportError:
    _fcntl = None  # type: ignore[assignment]
try:
    from urllib.request import urlopen, Request
except ImportError:
    from urllib2 import urlopen, Request
from server import db as server_db
from server import auth as server_auth
from server import rate_limit


def _require_env(name):
    """Server-side service credentials live in /etc/dashboard.env (loaded
    by systemd via EnvironmentFile). Crashing on startup if one is missing
    is better than silently 500-ing every request that needs it.

    During pytest runs ('pytest' in sys.modules) we return an empty string
    rather than raising SystemExit, so the module can be imported for
    auth-endpoint tests without needing production API keys."""
    import sys
    val = os.environ.get(name)
    if not val:
        if 'pytest' in sys.modules:
            return ''
        raise SystemExit(
            'ERROR: required environment variable {} is missing. '
            'Set it in /etc/dashboard.env (loaded by todo-api.service).'.format(name)
        )
    return val


DATA_FILE    = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'todos.json')
PLAN_FILE    = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'plan.json')
LINKS_FILE   = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'links.json')
HOME_FILE    = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'home.json')
WISH_CACHE   = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'wishlist_cache.json')
VG_HOME      = 'https://www.vg.no/'
VG_RSS       = 'https://www.vg.no/rss/feed/'
HEADERS      = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
STEAM_API_KEY  = _require_env('STEAM_API_KEY')
ITAD_API_KEY   = _require_env('ITAD_API_KEY')
STEAM_ID       = _require_env('STEAM_ID')
WISH_TTL       = 3600  # cache for 1 hour

CANVAS_TOKEN   = _require_env('CANVAS_TOKEN')
CANVAS_BASE    = 'https://hiof.instructure.com/api/v1'
SKOLE_CACHE    = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'skole_cache.json')
SKOLE_TTL      = 1800  # 30 minutes
PDF_CACHE_DIR  = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pdf_cache')
PDF_TTL        = 86400  # 24 hours

# Reports (bug / feature log) — kept ONE LEVEL UP from www so nginx
# doesn't serve the markdown publicly. The api.py service runs as
# root with WorkingDirectory=/opt/dashboard/www, so writes here
# resolve to /opt/dashboard/reports/.
REPORTS_DIR    = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'reports'))
REPORT_TYPES   = ('bug', 'feature')
REPORT_MAX_BODY     = 8000
REPORT_MAX_TITLE    = 200
REPORT_MAX_PAYLOAD  = 64_000

CANVAS_COURSES = {
    10644: {'name': 'Statistikk',             'short': 'STAT', 'color': '#38bdf8', 'total_expected': 7},
    10666: {'name': 'Parallell programmering', 'short': 'PARA', 'color': '#a78bfa', 'total_expected': 14},
}

PARPROG_DEADLINES = {
    'lab1':  '2026-01-14T22:59:00Z', 'lab2':  '2026-01-21T22:59:00Z',
    'lab3':  '2026-01-28T22:59:00Z', 'lab4':  '2026-02-04T22:59:00Z',
    'lab5':  '2026-02-14T22:59:00Z', 'lab6':  '2026-02-25T22:59:00Z',
    'lab7':  '2026-03-04T22:59:00Z', 'lab8':  '2026-03-11T22:59:00Z',
    'lab9':  '2026-03-18T22:59:00Z', 'lab10': '2026-03-25T22:59:00Z',
    'lab11': '2026-04-01T22:59:00Z',
}

# Labs confirmed submitted via GitHub (Canvas doesn't track these)
PARPROG_SUBMITTED = {'lab1','lab2','lab3','lab4','lab5','lab6','lab7','lab8','lab9','lab10'}

# Manual assignments not yet on Canvas (injected so they appear as upcoming)
STAT_MANUAL = {
    'Øving 6': {'due_at': '2026-04-12T21:59:00Z', 'html_url': 'https://hiof.instructure.com/courses/10644/assignments'},
}

GITHUB_REPO = 'PDP2026/labs-Maxaubert'

def get_github_submitted_labs():
    """Check public GitHub repo for submitted lab folders."""
    try:
        url = 'https://api.github.com/repos/{}/contents'.format(GITHUB_REPO)
        req = Request(url, headers={'User-Agent': HEADERS['User-Agent']})
        items = json.loads(urlopen(req, timeout=10).read().decode('utf-8'))
        submitted = set()
        for item in items:
            if item.get('type') == 'dir':
                m = re.match(r'^lab(\d+)$', item['name'].lower())
                if m:
                    submitted.add('lab' + str(int(m.group(1))))
        return submitted
    except Exception:
        return set()

def _normalize(s):
    """Lowercase and strip special chars for fuzzy file matching."""
    s = s.lower()
    s = s.replace('\u00f8', 'o').replace('\u00e6', 'ae').replace('\u00e5', 'a')
    return re.sub(r'[^a-z0-9]', '', s)

def _canvas_download(course_id, search_term, cache_path):
    """List Canvas course files, find best PDF match for search_term, download+cache, return bytes."""
    url = CANVAS_BASE + '/courses/{}/files?per_page=100'.format(course_id)
    req = Request(url, headers={'Authorization': 'Bearer ' + CANVAS_TOKEN, 'User-Agent': HEADERS['User-Agent']})
    files = json.loads(urlopen(req, timeout=15).read().decode('utf-8'))
    needle = _normalize(search_term)
    dl_url = None
    # Priority 1: exact stem match
    for f in files:
        nm = f.get('display_name', '')
        if not nm.lower().endswith('.pdf'):
            continue
        stem = nm.rsplit('.', 1)[0]
        if stem == search_term or _normalize(stem) == needle:
            dl_url = f.get('url', '')
            break
    # Priority 2: fuzzy contains
    if not dl_url:
        for f in files:
            nm = f.get('display_name', '')
            if not nm.lower().endswith('.pdf'):
                continue
            if needle in _normalize(nm):
                dl_url = f.get('url', '')
                break
    if not dl_url:
        return None
    req2 = Request(dl_url, headers={'Authorization': 'Bearer ' + CANVAS_TOKEN, 'User-Agent': HEADERS['User-Agent']})
    data = urlopen(req2, timeout=30).read()
    with open(cache_path, 'wb') as f_out:
        f_out.write(data)
    return data

def fetch_stat_pdf(stat_name):
    """Fetch a Statistikk PDF from Canvas, cache on disk, return bytes."""
    os.makedirs(PDF_CACHE_DIR, exist_ok=True)
    cache_path = os.path.join(PDF_CACHE_DIR, 'stat_' + _normalize(stat_name) + '.pdf')
    if os.path.exists(cache_path) and time.time() - os.path.getmtime(cache_path) < PDF_TTL:
        with open(cache_path, 'rb') as f:
            return f.read()
    try:
        return _canvas_download(10644, stat_name, cache_path)
    except Exception:
        if os.path.exists(cache_path):
            with open(cache_path, 'rb') as f:
                return f.read()
        return None

def fetch_lab_pdf(lab_num):
    """Fetch a ParProg lab PDF from GitHub (PDP2026/labs), cache on disk, return bytes."""
    os.makedirs(PDF_CACHE_DIR, exist_ok=True)
    cache_path = os.path.join(PDF_CACHE_DIR, 'lab_{}.pdf'.format(lab_num))
    if os.path.exists(cache_path) and time.time() - os.path.getmtime(cache_path) < PDF_TTL:
        with open(cache_path, 'rb') as f:
            return f.read()
    # Lab PDFs live in the public GitHub course repo: PDP2026/labs/labN/labN.pdf
    # Try both main branch and master branch
    for branch in ('main', 'master'):
        url = 'https://raw.githubusercontent.com/PDP2026/labs/{}/lab{}/lab{}.pdf'.format(
            branch, lab_num, lab_num)
        try:
            req  = Request(url, headers={'User-Agent': HEADERS['User-Agent']})
            data = urlopen(req, timeout=20).read()
            if data[:4] == b'%PDF':   # sanity check it's actually a PDF
                with open(cache_path, 'wb') as f:
                    f.write(data)
                return data
        except Exception:
            pass
    # Stale cache is better than nothing
    if os.path.exists(cache_path):
        with open(cache_path, 'rb') as f:
            return f.read()
    return None

def canvas_get(path, params=None):
    url = CANVAS_BASE + path
    if params:
        url += '?' + '&'.join('{}={}'.format(k, v) for k, v in params.items())
    req = Request(url, headers={'Authorization': 'Bearer ' + CANVAS_TOKEN, 'User-Agent': HEADERS['User-Agent']})
    return json.loads(urlopen(req, timeout=15).read().decode('utf-8'))

def fetch_skole():
    if os.path.exists(SKOLE_CACHE):
        try:
            cached = json.load(open(SKOLE_CACHE))
            if time.time() - cached.get('ts', 0) < SKOLE_TTL:
                return cached['data']
        except Exception:
            pass

    from datetime import datetime, timezone, timedelta
    now_utc = datetime.now(timezone.utc)
    result  = {'courses': [], 'announcements': []}

    # Fetch GitHub-submitted ParProg labs once (public repo, no auth needed)
    github_submitted = get_github_submitted_labs()

    for cid, meta in CANVAS_COURSES.items():
        try:
            assignments = canvas_get('/courses/{}/assignments'.format(cid),
                                     {'per_page': '100', 'order_by': 'due_at'})
            subs_raw    = canvas_get('/courses/{}/students/submissions'.format(cid),
                                     {'student_ids[]': 'self', 'per_page': '100'})
            subs = {s['assignment_id']: s for s in subs_raw}

            submitted_count = 0
            course_assignments = []
            canvas_titles = set()
            for a in assignments:
                sub       = subs.get(a['id'], {})
                submitted = sub.get('workflow_state') in ('submitted', 'graded')
                # For ParProg: use manual submitted set + GitHub as source of truth
                if cid == 10666:
                    key = a['name'].strip().lower()
                    if key in PARPROG_SUBMITTED or key in github_submitted:
                        submitted = True
                if submitted:
                    submitted_count += 1
                due_at = a.get('due_at')
                if cid == 10666:
                    key = a['name'].strip().lower()
                    if key in PARPROG_DEADLINES:
                        due_at = PARPROG_DEADLINES[key]
                canvas_titles.add(a['name'])
                course_assignments.append({
                    'id':        a['id'],
                    'title':     a['name'],
                    'due_at':    due_at,
                    'submitted': submitted,
                    'html_url':  a.get('html_url', '{}/courses/{}/assignments/{}'.format('https://hiof.instructure.com', cid, a['id'])),
                })

            # Inject manual assignments not yet on Canvas
            if cid == 10644:
                for title, info in STAT_MANUAL.items():
                    if title not in canvas_titles:
                        course_assignments.append({
                            'id': None, 'title': title,
                            'due_at': info['due_at'], 'submitted': False,
                            'html_url': info['html_url'],
                        })

            total = max(len(course_assignments), meta.get('total_expected', 0))
            result['courses'].append({
                'id': cid, 'name': meta['name'], 'short': meta['short'],
                'color': meta['color'], 'submitted': submitted_count,
                'total': total, 'assignments': course_assignments,
            })
        except Exception:
            pass

        # Announcements (last 7 days)
        try:
            anns = canvas_get('/courses/{}/discussion_topics'.format(cid),
                              {'only_announcements': 'true', 'per_page': '10', 'order_by': 'posted_at'})
            cutoff = now_utc - timedelta(days=7)
            for ann in anns:
                posted_str = ann.get('posted_at', '')
                if not posted_str:
                    continue
                try:
                    posted_dt = datetime.fromisoformat(posted_str.replace('Z', '+00:00'))
                    if posted_dt >= cutoff:
                        result['announcements'].append({
                            'title':        ann.get('title', ''),
                            'posted_at':    posted_str,
                            'html_url':     ann.get('html_url', ''),
                            'course_name':  meta['name'],
                            'course_short': meta['short'],
                            'course_color': meta['color'],
                        })
                except Exception:
                    pass
        except Exception:
            pass

    try:
        with open(SKOLE_CACHE, 'w') as f:
            json.dump({'ts': time.time(), 'data': result}, f)
    except Exception:
        pass

    return result

def fetch_wishlist():
    """Fetch Steam wishlist + live NOK prices. Returns cached data if fresh."""
    # Return cache if still valid
    if os.path.exists(WISH_CACHE):
        try:
            cached = json.load(open(WISH_CACHE))
            if time.time() - cached.get('ts', 0) < WISH_TTL:
                return cached['data']
        except Exception:
            pass

    # Fetch wishlist via official Steam Web API
    url = 'https://api.steampowered.com/IWishlistService/GetWishlist/v1/?key={}&steamid={}'.format(STEAM_API_KEY, STEAM_ID)
    try:
        req   = Request(url, headers=HEADERS)
        data  = json.loads(urlopen(req, timeout=15).read().decode('utf-8'))
        items = data.get('response', {}).get('items', [])
    except Exception:
        return []

    if not items:
        return []

    # Build lookup map: appid -> wishlist metadata
    item_map = {str(i['appid']): i for i in items}

    # Fetch prices + genres in batches of 20 via appdetails
    appids = list(item_map.keys())
    prices = {}
    for appid in appids:
        url = 'https://store.steampowered.com/api/appdetails?appids={}&cc=no&filters=basic,price_overview,genres'.format(appid)
        try:
            req   = Request(url, headers=HEADERS)
            pdata = json.loads(urlopen(req, timeout=10).read().decode('utf-8', errors='replace'))
            info  = pdata.get(str(appid), {})
            if info.get('success') and info.get('data'):
                prices[str(appid)] = info['data']
        except Exception:
            pass

    # Build game list
    games = []
    for appid, wdata in item_map.items():
        pd       = prices.get(appid, {})
        po       = pd.get('price_overview', {})
        genres   = [g['description'] for g in pd.get('genres', [])]
        discount = po.get('discount_percent', 0)
        is_free  = pd.get('is_free', False)
        on_sale  = discount > 0 and not is_free
        price    = po.get('final_formatted') if not is_free else None
        orig     = po.get('initial_formatted', '') if on_sale else ''
        name     = pd.get('name') or wdata.get('name', '')
        img      = pd.get('header_image') or 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{}/header.jpg'.format(appid)
        games.append({
            'appid':     appid,
            'name':      name,
            'imgUrl':    img,
            'imgFallback': 'https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg'.format(appid),
            'storeUrl':  'https://store.steampowered.com/app/{}/'.format(appid),
            'isFree':    is_free,
            'price':     price,
            'origPrice': orig,
            'discount':  discount,
            'onSale':    on_sale,
            'genres':    genres,
            'priority':  wdata.get('priority', 0),
            'dateAdded': wdata.get('date_added', 0),
            'priceInt':  po.get('final', 0),
            'currency':  po.get('currency', 'NOK'),
            'priceTag':  None,
            'itadId':    None,
        })

    # Fetch ITAD IDs so the price history chart works in the modal
    for g in games:
        try:
            url  = 'https://api.isthereanydeal.com/games/lookup/v1?key={}&appid={}'.format(ITAD_API_KEY, g['appid'])
            req  = Request(url, headers=HEADERS)
            data = json.loads(urlopen(req, timeout=8).read().decode('utf-8'))
            gid  = (data.get('game') or {}).get('id')
            if gid:
                g['itadId'] = gid
        except Exception:
            pass

    # Tag on-sale games that are at their all-time low using the history endpoint
    # (same endpoint the frontend uses for the price chart — known to work)
    # Only runs for games currently on sale, so typically just a handful of calls.
    ATL_SINCE = '2013-01-01T00:00:00Z'  # go far back to capture true all-time low
    for g in games:
        if not g['onSale'] or not g.get('itadId'):
            continue
        try:
            url = 'https://api.isthereanydeal.com/games/history/v2?key={}&id={}&shops=61&since={}'.format(
                ITAD_API_KEY, g['itadId'], ATL_SINCE)
            req  = Request(url, headers=HEADERS)
            raw  = json.loads(urlopen(req, timeout=8).read().decode('utf-8'))
            # Each entry: {timestamp, deal: {price: {amount, cut, ...}, ...}}
            cuts = [p['deal']['cut'] for p in raw if p.get('deal')]
            if cuts:
                best_cut = max(cuts)
                # Within 5 percentage points of the all-time best discount → hot
                if best_cut > 0 and g['discount'] >= best_cut - 5:
                    g['priceTag'] = 'hot'
        except Exception:
            pass

    games.sort(key=lambda g: (g['priority'], g['name'].lower()))

    # Save cache
    try:
        with open(WISH_CACHE, 'w') as f:
            json.dump({'ts': time.time(), 'data': games}, f)
    except Exception:
        pass

    return games

def _slug(url):
    """Extract short article ID from VG URL, e.g. /i/aJJGp7/ -> aJJGp7"""
    m = re.search(r'/i/([A-Za-z0-9]+)', url)
    return m.group(1) if m else url

def _og(url):
    """Fetch OpenGraph title/desc/image — handles both attribute orderings."""
    def og_val(html, prop):
        # matches property before content OR content before property
        m = re.search(r'<meta[^>]+property="' + prop + r'"[^>]+content="([^"]+)"', html)
        if not m:
            m = re.search(r'<meta[^>]+content="([^"]+)"[^>]+property="' + prop + r'"', html)
        return m.group(1) if m else ''
    try:
        req = Request(url, headers=HEADERS)
        html = urlopen(req, timeout=5).read().decode('utf-8', errors='replace')
        return {
            'title': og_val(html, 'og:title'),
            'desc':  og_val(html, 'og:description')[:120],
            'img':   og_val(html, 'og:image').replace('&amp;', '&'),
        }
    except Exception:
        return {'title': '', 'desc': '', 'img': ''}

def get_top_urls():
    """Fetch VG front page and return ordered article URLs."""
    req = Request(VG_HOME, headers=HEADERS)
    html = urlopen(req, timeout=5).read().decode('utf-8', errors='replace')
    ld_blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL)
    for block in ld_blocks:
        try:
            data = json.loads(block)
            items = data.get('mainEntity', {}).get('itemListElement', [])
            if items:
                return [it['url'] for it in items[:20] if 'url' in it]
        except Exception:
            pass
    return []

def get_rss_map():
    """Build slug->article dict from VG RSS feed."""
    rss_map = {}
    try:
        req = Request(VG_RSS, headers=HEADERS)
        xml = urlopen(req, timeout=5).read().decode('utf-8', errors='replace')
        for item in re.findall(r'<item>(.*?)</item>', xml, re.DOTALL):
            link  = re.search(r'<link>(.*?)</link>', item, re.DOTALL)
            title = re.search(r'<title><!\[CDATA\[(.*?)\]\]></title>|<title>(.*?)</title>', item, re.DOTALL)
            desc  = re.search(r'<description><!\[CDATA\[(.*?)\]\]></description>|<description>(.*?)</description>', item, re.DOTALL)
            img   = re.search(r'<vg:img>(.*?)</vg:img>|<enclosure url="([^"]+)"', item)
            url   = (link.group(1) or '').strip() if link else ''
            slug  = _slug(url)
            if slug:
                raw_img = (img.group(1) or img.group(2) or '').strip() if img else ''
                rss_map[slug] = {
                    'link':  url,
                    'title': (title.group(1) or title.group(2) or '').strip() if title else '',
                    'desc':  re.sub(r'<[^>]+>', '', (desc.group(1) or desc.group(2) or '').strip())[:120] if desc else '',
                    'img':   raw_img.replace('&amp;', '&'),
                }
    except Exception:
        pass
    return rss_map

NRK_RSS          = 'https://www.nrk.no/toppsaker.rss'
AFTENPOSTEN_RSS  = 'https://www.aftenposten.no/rss'

def _parse_generic_rss(url, limit=40):
    """Parse a standard RSS feed into [{title, link, desc, img}, ...].
    Handles the image variants used by NRK and Aftenposten: `media:thumbnail`,
    `media:content medium="image"`, and plain `enclosure url=...`.
    """
    try:
        req  = Request(url, headers=HEADERS)
        xml  = urlopen(req, timeout=5).read().decode('utf-8', errors='replace')
    except Exception:
        return []
    items = []
    for block in re.findall(r'<item>(.*?)</item>', xml, re.DOTALL)[:limit]:
        title_m = re.search(r'<title><!\[CDATA\[(.*?)\]\]></title>|<title>(.*?)</title>', block, re.DOTALL)
        link_m  = re.search(r'<link>(.*?)</link>', block, re.DOTALL)
        desc_m  = re.search(r'<description><!\[CDATA\[(.*?)\]\]></description>|<description>(.*?)</description>', block, re.DOTALL)
        img_m   = (re.search(r'<media:thumbnail[^>]+url="([^"]+)"', block)
                or re.search(r'<media:content[^>]+url="([^"]+)"[^>]*medium="image"', block)
                or re.search(r'<media:content[^>]+medium="image"[^>]*url="([^"]+)"', block)
                or re.search(r'<enclosure[^>]+url="([^"]+)"[^>]+type="image', block)
                or re.search(r'<enclosure[^>]+type="image[^"]*"[^>]+url="([^"]+)"', block))
        title = (title_m.group(1) or title_m.group(2) or '').strip() if title_m else ''
        link  = (link_m.group(1) or '').strip() if link_m else ''
        desc  = (desc_m.group(1) or desc_m.group(2) or '').strip() if desc_m else ''
        img   = (img_m.group(1) or '').replace('&amp;', '&') if img_m else ''
        # Strip inline HTML from descriptions that embed it.
        desc  = re.sub(r'<[^>]+>', '', desc).strip()[:200]
        if link and title:
            items.append({'title': title, 'link': link, 'desc': desc, 'img': img})
    return items

def fetch_vg_news():
    """VG: scrape homepage for ordered URLs, enrich via RSS map or OG tags.
    Falls back to pure RSS if the homepage JSON-LD doesn't expose
    `itemListElement` (April 2026 layout change)."""
    top_urls = get_top_urls()
    rss_map  = get_rss_map()
    if not top_urls:
        return list(rss_map.values())
    results = []
    for url in top_urls:
        slug = _slug(url)
        if slug in rss_map:
            results.append(dict(rss_map[slug]))
        else:
            og = _og(url)
            results.append({'link': url, 'title': og['title'], 'desc': og['desc'], 'img': og['img']})
    return results

def fetch_news(offset, count, source='vg'):
    if source == 'nrk':
        items = _parse_generic_rss(NRK_RSS)
    elif source == 'aftenposten':
        items = _parse_generic_rss(AFTENPOSTEN_RSS)
    else:
        items = fetch_vg_news()
    return items[offset:offset + count]

def _strip_control(s):
    """Drop C0 control chars except tab/newline/CR — same rules the dev
    plugin uses, so reports written through /api/report and through the
    Vite dev middleware look identical."""
    out = []
    for ch in s:
        c = ord(ch)
        if c == 9 or c == 10 or c == 13:
            out.append(ch)
        elif c < 0x20 or c == 0x7f:
            continue
        else:
            out.append(ch)
    return ''.join(out)


def _sanitize_field(value, max_len):
    if not isinstance(value, str):
        return ''
    return _strip_control(value)[:max_len].strip()


def _parse_report(raw):
    try:
        obj = json.loads(raw.decode('utf-8') if isinstance(raw, (bytes, bytearray)) else raw)
    except Exception:
        return None
    if not isinstance(obj, dict):
        return None
    rtype = _sanitize_field(obj.get('type', ''), 16)
    title = _sanitize_field(obj.get('title', ''), REPORT_MAX_TITLE)
    body  = _sanitize_field(obj.get('body', ''), REPORT_MAX_BODY)
    page  = _sanitize_field(obj.get('page', ''), 200)
    if rtype not in REPORT_TYPES:
        return None
    if not title:
        return None
    return {'type': rtype, 'title': title, 'body': body, 'page': page or None}


def _report_file_header(rtype):
    noun = 'Bug reports' if rtype == 'bug' else 'Feature requests'
    return (
        '# {}\n\n'
        '<!-- Append-only log. Newest entries at the bottom. '
        'Edit `status:` by hand to mark items as resolved/done. -->\n'
    ).format(noun)


def _format_report_entry(report):
    stamp = time.strftime('%Y-%m-%d %H:%M', time.localtime())
    meta = []
    if report.get('page'):
        meta.append('- **page**: `{}`'.format(report['page']))
    meta.append('- **status**: open')
    body_block = '\n' + report['body'] + '\n' if report['body'] else ''
    return '\n---\n\n### {} — {}\n\n{}\n{}'.format(
        stamp, report['title'], '\n'.join(meta), body_block
    )


def _append_report(report):
    """Append `report` to /opt/dashboard/reports/{type}s.md. Creates
    the directory and seeds the file header on first write. Returns
    a stable short path for the success response.

    Holds an exclusive fcntl lock around the entire read-check-write
    sequence so two simultaneous reports (or a report racing the very
    first write that seeds the header) can't interleave or clobber."""
    if not os.path.isdir(REPORTS_DIR):
        os.makedirs(REPORTS_DIR, exist_ok=True)
    fname = '{}s.md'.format(report['type'])
    fpath = os.path.join(REPORTS_DIR, fname)
    with open(fpath, 'a+', encoding='utf-8') as f:
        if _fcntl is not None:
            _fcntl.flock(f.fileno(), _fcntl.LOCK_EX)
        try:
            f.seek(0)
            if not f.read(1):
                f.write(_report_file_header(report['type']))
            f.write(_format_report_entry(report))
        finally:
            if _fcntl is not None:
                _fcntl.flock(f.fileno(), _fcntl.LOCK_UN)
    return 'reports/' + fname


class Handler(BaseHTTPRequestHandler):
    @property
    def current_user(self):
        """Lazily resolve the current user from the session cookie.
        Cached per-request via _current_user_cache."""
        if hasattr(self, '_current_user_cache'):
            return self._current_user_cache
        cookie = self.headers.get('Cookie', '')
        sid = server_auth.parse_session_cookie(cookie)
        if sid is None:
            self._current_user_cache = None
        else:
            try:
                self._current_user_cache = server_auth.load_session(sid)
            except Exception:
                self._current_user_cache = None
        return self._current_user_cache

    def require_auth(self):
        """Helper: return current_user or send 401 and return None.
        Endpoints that need auth start with:
            user = self.require_auth()
            if user is None: return
        """
        user = self.current_user
        if user is None:
            self.send_response(401)
            self._cors()
            self.send_header('Content-Type', 'application/json')
            body = b'{"error":"not authenticated"}'
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return None
        return user

    def _handle_signup(self):
        """POST /api/auth/signup: { code, email, password, display_name }"""
        client_ip = self.client_address[0]
        if not rate_limit.check('signup', client_ip, max_count=10, window_seconds=3600):
            return self._json(429, {'error': 'too many signup attempts'})

        try:
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length))
        except Exception:
            return self._json(400, {'error': 'invalid JSON'})

        code = (body.get('code') or '').strip()
        email = (body.get('email') or '').strip().lower()
        password = body.get('password') or ''
        display_name = (body.get('display_name') or '').strip()

        if not (code and email and password and display_name):
            return self._json(400, {'error': 'missing fields'})
        if len(password) < 10:
            return self._json(400, {'error': 'password must be at least 10 characters'})
        if '@' not in email:
            return self._json(400, {'error': 'invalid email'})

        # Validate + consume invite atomically. UPDATE returning 1 row =
        # we won the race; 0 rows = code was already used or doesn't exist.
        with server_db.tx() as conn:
            with conn.cursor() as cur:
                # Check email isn't taken first (separate query so we can
                # report 409 vs 401 cleanly)
                cur.execute("SELECT 1 FROM users WHERE email = %s", (email,))
                if cur.fetchone() is not None:
                    return self._json(409, {'error': 'email already registered'})

                # Try to claim the invite
                cur.execute(
                    "UPDATE invite_codes SET used_at = now() "
                    "WHERE code = %s AND used_at IS NULL "
                    "RETURNING code",
                    (code,),
                )
                if cur.fetchone() is None:
                    return self._json(401, {'error': 'invalid or used invite code'})

                # Create the user
                cur.execute(
                    "INSERT INTO users (email, password_hash, display_name) "
                    "VALUES (%s, %s, %s) RETURNING id",
                    (email, server_auth.hash_password(password), display_name),
                )
                user_id = cur.fetchone()['id']

                # Stamp the invite with who used it
                cur.execute(
                    "UPDATE invite_codes SET used_by_id = %s WHERE code = %s",
                    (user_id, code),
                )

        # Create session, set cookie, return user payload.
        sid = server_auth.create_session(
            user_id,
            ttl_seconds=30 * 24 * 3600,
            user_agent=self.headers.get('User-Agent'),
        )
        self._json(200, {
            'user': {'id': user_id, 'email': email, 'display_name': display_name}
        }, extra_headers=[
            ('Set-Cookie', server_auth.set_session_cookie_header(sid, ttl_seconds=30 * 24 * 3600))
        ])

    def _handle_login(self):
        client_ip = self.client_address[0]
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length))
        except Exception:
            return self._json(400, {'error': 'invalid JSON'})

        email = (body.get('email') or '').strip().lower()
        password = body.get('password') or ''
        if not (email and password):
            return self._json(400, {'error': 'missing fields'})

        rows = server_db.query(
            "SELECT id, password_hash, email, display_name "
            "FROM users WHERE email = %s",
            (email,),
        )
        if not rows or not server_auth.verify_password(rows[0]['password_hash'], password):
            # Only burn a rate-limit slot on actual failure so successful
            # logins don't penalize the user.
            if not rate_limit.check('login', client_ip, max_count=5, window_seconds=900):
                return self._json(429, {'error': 'too many failed login attempts'})
            return self._json(401, {'error': 'invalid credentials'})

        user = rows[0]
        sid = server_auth.create_session(
            user['id'], ttl_seconds=30 * 24 * 3600,
            user_agent=self.headers.get('User-Agent'),
        )
        self._json(200, {
            'user': {'id': user['id'], 'email': user['email'],
                     'display_name': user['display_name']}
        }, extra_headers=[
            ('Set-Cookie', server_auth.set_session_cookie_header(sid, ttl_seconds=30 * 24 * 3600))
        ])

    def _handle_logout(self):
        cookie = self.headers.get('Cookie', '')
        sid = server_auth.parse_session_cookie(cookie)
        if sid:
            try:
                server_auth.delete_session(sid)
            except Exception:
                pass
        self.send_response(204)
        self._cors()
        self.send_header('Set-Cookie', server_auth.clear_session_cookie_header())
        self.end_headers()

    def _handle_me(self):
        user = self.current_user
        if user is None:
            return self._json(401, {'error': 'not authenticated'})
        return self._json(200, {'user': user})

    def _handle_admin_invites(self):
        user = self.require_auth()
        if user is None:
            return
        if user['id'] != 1:
            return self._json(403, {'error': 'admin only'})

        try:
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length))
        except Exception:
            body = {}

        count = max(1, min(50, int(body.get('count', 1))))
        codes = []
        with server_db.tx() as conn:
            with conn.cursor() as cur:
                for _ in range(count):
                    code = server_auth.generate_invite_code()
                    cur.execute(
                        "INSERT INTO invite_codes (code, created_by_id) "
                        "VALUES (%s, %s)",
                        (code, user['id']),
                    )
                    codes.append(code)
        return self._json(200, {'codes': codes})

    def _handle_todos_get(self):
        """GET /api/todos: returns the current user's todos as a JSON list.

        Schema mapping: DB BIGINT id is returned as a string to match the
        existing frontend's expectation (Todo.id is a string in the JSON
        envelope and React keys). camelCase: completed_at -> completedAt."""
        user = self.require_auth()
        if user is None:
            return
        rows = server_db.query(
            "SELECT id, text, priority, deadline, done, pinned, "
            "completed_at, position "
            "FROM todos WHERE user_id = %s ORDER BY position",
            (user['id'],),
        )
        todos = []
        for r in rows:
            todos.append({
                'id': str(r['id']),
                'text': r['text'],
                'priority': r['priority'],
                'deadline': r['deadline'].isoformat() if r['deadline'] else None,
                'done': r['done'],
                'pinned': r['pinned'],
                'completedAt': r['completed_at'].isoformat() if r['completed_at'] else None,
            })
        return self._json(200, todos)

    def _handle_todos_post(self):
        """POST /api/todos: bulk upsert the entire todos list for the
        current user, then delete any not present (frontend always sends
        the whole list — same shape as the JSON-file era).

        Wrapped in a single transaction so a partial failure can't leave
        the user with half-written state."""
        user = self.require_auth()
        if user is None:
            return
        try:
            length = int(self.headers.get('Content-Length', 0))
            payload = json.loads(self.rfile.read(length))
        except Exception:
            return self._json(400, {'error': 'invalid JSON'})
        if not isinstance(payload, list):
            return self._json(400, {'error': 'expected a list'})

        kept_ids = []
        with server_db.tx() as conn:
            with conn.cursor() as cur:
                for position, t in enumerate(payload):
                    try:
                        id_int = int(t['id'])
                    except (KeyError, ValueError, TypeError):
                        continue
                    kept_ids.append(id_int)
                    cur.execute(
                        "INSERT INTO todos (id, user_id, text, priority, "
                        "deadline, done, pinned, completed_at, position) "
                        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) "
                        "ON CONFLICT (id) DO UPDATE SET "
                        "text = EXCLUDED.text, priority = EXCLUDED.priority, "
                        "deadline = EXCLUDED.deadline, done = EXCLUDED.done, "
                        "pinned = EXCLUDED.pinned, "
                        "completed_at = EXCLUDED.completed_at, "
                        "position = EXCLUDED.position",
                        (
                            id_int, user['id'], t.get('text', ''),
                            t.get('priority', 'medium') if t.get('priority') in ('high', 'medium', 'low') else 'medium',
                            t.get('deadline') or None,
                            bool(t.get('done', False)),
                            bool(t.get('pinned', False)),
                            t.get('completedAt') or None,
                            position,
                        ),
                    )
                # Delete rows for this user that are no longer in the
                # payload. Use AND id NOT IN (kept_ids) — empty list means
                # delete everything for this user.
                if kept_ids:
                    cur.execute(
                        "DELETE FROM todos WHERE user_id = %s AND id != ALL(%s)",
                        (user['id'], kept_ids),
                    )
                else:
                    cur.execute(
                        "DELETE FROM todos WHERE user_id = %s",
                        (user['id'],),
                    )
        return self._json(200, {'ok': True})

    def _handle_plan_get(self):
        """GET /api/plan: returns the current user's plan events.

        Ordered by (date, start_time) so the calendar/list views render
        in chronological order without client-side sorting. start_time /
        end_time come back as 'HH:MM' strings (matching the JSON-era
        format) instead of psycopg's full 'HH:MM:SS'."""
        user = self.require_auth()
        if user is None:
            return
        rows = server_db.query(
            "SELECT id, title, date, start_time, end_time, tag, location, "
            "color, recurring "
            "FROM plan_events WHERE user_id = %s "
            "ORDER BY date, start_time NULLS FIRST, position",
            (user['id'],),
        )
        events = []
        for r in rows:
            events.append({
                'id': r['id'],
                'title': r['title'],
                'date': r['date'].isoformat(),
                'startTime': r['start_time'].strftime('%H:%M') if r['start_time'] else '',
                'endTime': r['end_time'].strftime('%H:%M') if r['end_time'] else '',
                'tag': r['tag'] or '',
                'location': r['location'] or '',
                'color': r['color'] or '',
                'recurring': r['recurring'],
            })
        return self._json(200, events)

    def _handle_plan_post(self):
        """POST /api/plan: bulk upsert the entire plan-events list for
        the current user, then delete any not present. Same single-
        transaction pattern as /api/todos."""
        user = self.require_auth()
        if user is None:
            return
        try:
            length = int(self.headers.get('Content-Length', 0))
            payload = json.loads(self.rfile.read(length))
        except Exception:
            return self._json(400, {'error': 'invalid JSON'})
        if not isinstance(payload, list):
            return self._json(400, {'error': 'expected a list'})

        kept_ids = []
        with server_db.tx() as conn:
            with conn.cursor() as cur:
                for position, ev in enumerate(payload):
                    ev_id = ev.get('id')
                    if not ev_id or not isinstance(ev_id, str):
                        continue
                    title = ev.get('title') or ''
                    date = ev.get('date') or None
                    if not date:
                        # date-less rows are nonsensical for a calendar;
                        # skip rather than insert junk.
                        continue
                    start_time = ev.get('startTime') or None
                    end_time = ev.get('endTime') or None
                    kept_ids.append(ev_id)
                    cur.execute(
                        "INSERT INTO plan_events (id, user_id, title, date, "
                        "start_time, end_time, tag, location, color, "
                        "recurring, position) "
                        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
                        "ON CONFLICT (id) DO UPDATE SET "
                        "title = EXCLUDED.title, date = EXCLUDED.date, "
                        "start_time = EXCLUDED.start_time, "
                        "end_time = EXCLUDED.end_time, "
                        "tag = EXCLUDED.tag, location = EXCLUDED.location, "
                        "color = EXCLUDED.color, "
                        "recurring = EXCLUDED.recurring, "
                        "position = EXCLUDED.position",
                        (
                            ev_id, user['id'], title, date,
                            start_time, end_time,
                            ev.get('tag') or '',
                            ev.get('location') or '',
                            ev.get('color') or '',
                            bool(ev.get('recurring', False)),
                            position,
                        ),
                    )
                if kept_ids:
                    cur.execute(
                        "DELETE FROM plan_events "
                        "WHERE user_id = %s AND id != ALL(%s)",
                        (user['id'], kept_ids),
                    )
                else:
                    cur.execute(
                        "DELETE FROM plan_events WHERE user_id = %s",
                        (user['id'],),
                    )
        return self._json(200, {'ok': True})

    def _handle_links_get(self):
        """GET /api/links: returns the v2 envelope shape
        {version: 2, categories: [...], links: [...]} that the frontend's
        normaliseEnvelope expects. Order is positional in the array, set
        by the position column."""
        user = self.require_auth()
        if user is None:
            return
        cat_rows = server_db.query(
            "SELECT id, name, position, "
            "EXTRACT(EPOCH FROM created_at) * 1000 AS created_ms, "
            "EXTRACT(EPOCH FROM updated_at) * 1000 AS updated_ms "
            "FROM categories WHERE user_id = %s ORDER BY position",
            (user['id'],),
        )
        link_rows = server_db.query(
            "SELECT id, category_id, url, name, sub, color, icon_type, "
            "icon_value, favorite, position, "
            "EXTRACT(EPOCH FROM created_at) * 1000 AS created_ms, "
            "EXTRACT(EPOCH FROM updated_at) * 1000 AS updated_ms "
            "FROM links WHERE user_id = %s ORDER BY position",
            (user['id'],),
        )
        envelope = {
            'version': 2,
            'categories': [
                {
                    'id': c['id'],
                    'name': c['name'],
                    'order': c['position'],
                    'createdAt': int(c['created_ms']) if c['created_ms'] is not None else None,
                    'updatedAt': int(c['updated_ms']) if c['updated_ms'] is not None else None,
                }
                for c in cat_rows
            ],
            'links': [
                {
                    'id': r['id'],
                    'url': r['url'],
                    'name': r['name'],
                    'sub': r['sub'] or '',
                    'color': r['color'] or '',
                    'iconType': r['icon_type'] or '',
                    'iconValue': r['icon_value'] or '',
                    'favorite': r['favorite'],
                    'category': r['category_id'] or '',
                    'createdAt': int(r['created_ms']) if r['created_ms'] is not None else None,
                    'updatedAt': int(r['updated_ms']) if r['updated_ms'] is not None else None,
                }
                for r in link_rows
            ],
        }
        return self._json(200, envelope)

    def _handle_links_post(self):
        """POST /api/links: bulk upsert the entire categories + links
        envelope for the current user, then delete any not present.

        Single transaction with categories upserted FIRST so the links
        FK can reference them in the same transaction. Then links upsert.
        Then delete omitted links (must come before category deletes so
        the ON DELETE SET NULL doesn't fire for rows we're about to drop
        anyway). Then delete omitted categories."""
        user = self.require_auth()
        if user is None:
            return
        try:
            length = int(self.headers.get('Content-Length', 0))
            payload = json.loads(self.rfile.read(length))
        except Exception:
            return self._json(400, {'error': 'invalid JSON'})
        # Accept both the v2 envelope and a bare list (legacy frontend
        # versions); the frontend normaliseEnvelope reshapes our reply
        # either way, but the persistence side has always been a v2 dict.
        if isinstance(payload, list):
            payload = {'version': 2, 'links': payload, 'categories': []}
        if not isinstance(payload, dict):
            return self._json(400, {'error': 'expected v2 envelope'})

        categories = payload.get('categories') or []
        links = payload.get('links') or []
        if not isinstance(categories, list) or not isinstance(links, list):
            return self._json(400, {'error': 'expected categories + links to be lists'})

        kept_cat_ids = []
        kept_link_ids = []
        with server_db.tx() as conn:
            with conn.cursor() as cur:
                for position, c in enumerate(categories):
                    cat_id = c.get('id')
                    if not cat_id or not isinstance(cat_id, str):
                        continue
                    kept_cat_ids.append(cat_id)
                    cur.execute(
                        "INSERT INTO categories (id, user_id, name, position) "
                        "VALUES (%s, %s, %s, %s) "
                        "ON CONFLICT (id) DO UPDATE SET "
                        "name = EXCLUDED.name, position = EXCLUDED.position, "
                        "updated_at = now()",
                        (cat_id, user['id'], c.get('name') or '',
                         int(c.get('order', position) or 0)),
                    )
                for position, ln in enumerate(links):
                    ln_id = ln.get('id')
                    if not ln_id or not isinstance(ln_id, str):
                        continue
                    url = ln.get('url')
                    name = ln.get('name')
                    if not url or not name:
                        # Without url or name there's nothing to render.
                        continue
                    category = ln.get('category') or None
                    # If category id isn't in the kept set, drop it so
                    # the FK doesn't blow up. The ON DELETE SET NULL
                    # would catch this later but better to be explicit.
                    if category and category not in kept_cat_ids:
                        category = None
                    kept_link_ids.append(ln_id)
                    cur.execute(
                        "INSERT INTO links (id, user_id, category_id, url, "
                        "name, sub, color, icon_type, icon_value, favorite, "
                        "position) "
                        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
                        "ON CONFLICT (id) DO UPDATE SET "
                        "category_id = EXCLUDED.category_id, "
                        "url = EXCLUDED.url, name = EXCLUDED.name, "
                        "sub = EXCLUDED.sub, color = EXCLUDED.color, "
                        "icon_type = EXCLUDED.icon_type, "
                        "icon_value = EXCLUDED.icon_value, "
                        "favorite = EXCLUDED.favorite, "
                        "position = EXCLUDED.position, "
                        "updated_at = now()",
                        (
                            ln_id, user['id'], category, url, name,
                            ln.get('sub') or '', ln.get('color') or '',
                            ln.get('iconType') or '',
                            ln.get('iconValue') or '',
                            bool(ln.get('favorite', False)),
                            position,
                        ),
                    )
                if kept_link_ids:
                    cur.execute(
                        "DELETE FROM links WHERE user_id = %s AND id != ALL(%s)",
                        (user['id'], kept_link_ids),
                    )
                else:
                    cur.execute(
                        "DELETE FROM links WHERE user_id = %s",
                        (user['id'],),
                    )
                if kept_cat_ids:
                    cur.execute(
                        "DELETE FROM categories WHERE user_id = %s AND id != ALL(%s)",
                        (user['id'], kept_cat_ids),
                    )
                else:
                    cur.execute(
                        "DELETE FROM categories WHERE user_id = %s",
                        (user['id'],),
                    )
        return self._json(200, {'ok': True})

    def _json(self, status, payload, *, extra_headers=()):
        """Send a JSON response. Used by all auth endpoints."""
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        for k, v in extra_headers:
            self.send_header(k, v)
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == '/api/auth/me':
            return self._handle_me()
        if self.path == '/api/todos':
            return self._handle_todos_get()
        if self.path == '/api/plan':
            return self._handle_plan_get()
        if self.path == '/api/links':
            return self._handle_links_get()
        if self.path == '/api/home':
            try:
                if os.path.exists(HOME_FILE):
                    data = json.load(open(HOME_FILE))
                else:
                    data = {'version': 1, 'sections': [], 'widgets': [], 'habits': []}
            except Exception:
                data = {'version': 1, 'sections': [], 'widgets': [], 'habits': []}
            body = json.dumps(data).encode()
        elif self.path == '/api/skole':
            try:
                data = fetch_skole()
            except Exception:
                data = {'courses': [], 'announcements': []}
            body = json.dumps(data).encode()
        elif self.path == '/api/wishlist':
            try:
                data = fetch_wishlist()
            except Exception:
                data = []
            body = json.dumps(data).encode()
        elif self.path.startswith('/api/news'):
            try:
                qs = self.path.split('?', 1)[1] if '?' in self.path else ''
                params = dict(p.split('=') for p in qs.split('&') if '=' in p)
                offset = int(params.get('offset', 0))
                count  = int(params.get('count', 4))
                source = params.get('source', 'vg')
                data = fetch_news(offset, count, source)
            except Exception:
                data = []
            body = json.dumps(data).encode()
        elif self.path.startswith('/api/pdf'):
            try:
                from urllib.parse import unquote_plus
            except ImportError:
                from urllib import unquote_plus
            qs = self.path.split('?', 1)[1] if '?' in self.path else ''
            params = dict(p.split('=', 1) for p in qs.split('&') if '=' in p)
            stat_name = unquote_plus(params.get('stat', '')).strip()
            lab_num   = unquote_plus(params.get('lab',  '')).strip()
            pdf_bytes = None
            if stat_name:
                try:
                    pdf_bytes = fetch_stat_pdf(stat_name)
                except Exception:
                    pdf_bytes = None
            elif lab_num:
                try:
                    pdf_bytes = fetch_lab_pdf(lab_num)
                except Exception:
                    pdf_bytes = None
            else:
                self.send_response(400); self._cors(); self.end_headers(); return
            if pdf_bytes is None:
                self.send_response(404); self._cors(); self.end_headers(); return
            self.send_response(200)
            self.send_header('Content-Type', 'application/pdf')
            self.send_header('Content-Length', str(len(pdf_bytes)))
            self.send_header('Cache-Control', 'public, max-age=3600')
            self._cors()
            self.end_headers()
            self.wfile.write(pdf_bytes)
            return
        elif self.path.startswith('/api/favicon'):
            # Proxy Google favicon so the browser can canvas-read it (CORS bypass)
            try:
                qs = self.path.split('?', 1)[1] if '?' in self.path else ''
                params = dict(p.split('=', 1) for p in qs.split('&') if '=' in p)
                domain = params.get('domain', '').strip()
                if not domain:
                    raise ValueError('no domain')
                furl = 'https://www.google.com/s2/favicons?domain={}&sz=64'.format(domain)
                req      = Request(furl, headers=HEADERS)
                img_data = urlopen(req, timeout=6).read()
                self.send_response(200)
                self.send_header('Content-Type', 'image/png')
                self.send_header('Content-Length', str(len(img_data)))
                self.send_header('Cache-Control', 'public, max-age=86400')
                self._cors()
                self.end_headers()
                self.wfile.write(img_data)
            except Exception:
                self.send_response(404); self._cors(); self.end_headers()
            return
        else:
            self.send_response(404); self._cors(); self.end_headers(); return
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path == '/api/auth/signup':
            return self._handle_signup()
        if self.path == '/api/auth/login':
            return self._handle_login()
        if self.path == '/api/auth/logout':
            return self._handle_logout()
        if self.path == '/api/admin/invites':
            return self._handle_admin_invites()

        # /api/report — appends a markdown entry to /opt/dashboard/reports/{type}s.md.
        # Handled separately because it does NOT overwrite a JSON file.
        if self.path == '/api/report':
            try:
                length = int(self.headers.get('Content-Length', 0))
                if length <= 0 or length > REPORT_MAX_PAYLOAD:
                    self.send_response(413); self._cors(); self.end_headers(); return
                raw = self.rfile.read(length)
                report = _parse_report(raw)
                if report is None:
                    body = b'{"error":"invalid payload"}'
                    self.send_response(400)
                else:
                    rel = _append_report(report)
                    body = json.dumps({'ok': True, 'file': rel}).encode()
                    self.send_response(200)
            except Exception as e:
                body = json.dumps({'ok': False, 'error': str(e)}).encode()
                self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self._cors()
            self.end_headers()
            self.wfile.write(body)
            return

        if self.path == '/api/todos':
            return self._handle_todos_post()
        if self.path == '/api/plan':
            return self._handle_plan_post()
        if self.path == '/api/links':
            return self._handle_links_post()
        if self.path == '/api/home':
            file_path = HOME_FILE
        else:
            self.send_response(404); self._cors(); self.end_headers(); return
        try:
            length = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(length))
            # Atomic write: serialize to a temp file in the same directory,
            # fsync, then rename over the target. If the process dies mid-
            # write the target keeps its previous (valid) contents instead
            # of getting truncated. See: man 2 rename — same-FS rename is
            # atomic on POSIX.
            fd, tmp_path = tempfile.mkstemp(
                prefix='.' + os.path.basename(file_path) + '.',
                suffix='.tmp',
                dir=os.path.dirname(file_path),
            )
            try:
                with os.fdopen(fd, 'w') as f:
                    json.dump(data, f, indent=2)
                    f.flush()
                    os.fsync(f.fileno())
                os.replace(tmp_path, file_path)
            except Exception:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
                raise
            body = b'{"ok":true}'
        except Exception as e:
            body = json.dumps({'ok': False, 'error': str(e)}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass  # silence request logs

if __name__ == '__main__':
    db_url = os.environ.get('DASHBOARD_DB_URL')
    if not db_url:
        raise SystemExit('ERROR: DASHBOARD_DB_URL is missing from /etc/dashboard.env')
    server_db.init_pool(db_url, min_size=2, max_size=10)
    # ThreadingHTTPServer (not HTTPServer): the single-threaded variant
    # could wedge if a handler blocked or a client disconnected mid-write,
    # leaving the process "active" but no longer accepting connections.
    server = ThreadingHTTPServer(('0.0.0.0', 3001), Handler)
    server.daemon_threads = True
    print('Dashboard API running on port 3001 (DB pool active)')
    server.serve_forever()
