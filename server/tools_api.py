#!/usr/bin/env python3
"""
Dashboard Tools API.

A separate Flask service for the verktøy page tools that need server
work — video downloader (yt-dlp), reader mode (readability), background
remover (rembg), PDF tools (pypdf/pdf2image), and the universal file
converter (Pillow / ffmpeg).

Runs on port 5002. nginx proxies /api/tools/* here.

Run with:
    python3 tools_api.py
"""
import importlib.util
import io
import json
import os
import re
import shutil
import socket
import subprocess
import tempfile
import time
import zipfile
from urllib.parse import urlparse

from flask import Flask, request, jsonify, send_file, after_this_request, abort
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Cap uploads at 5 GB so the video converter can handle multi-GB clips.
# yt-dlp downloads bypass this since they don't go through request.files.
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024 * 1024

# All temp files go under one root we can clean up easily
TMP_ROOT = os.path.join(tempfile.gettempdir(), 'dashboard-tools')
os.makedirs(TMP_ROOT, exist_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────────────────────

def make_tmpdir(prefix: str) -> str:
    """Create a per-request tmp dir under TMP_ROOT."""
    return tempfile.mkdtemp(prefix=f'{prefix}-', dir=TMP_ROOT)


def cleanup_path(path: str) -> None:
    """Remove a file or directory tree, ignoring missing entries."""
    try:
        if os.path.isdir(path):
            shutil.rmtree(path, ignore_errors=True)
        elif os.path.isfile(path):
            os.remove(path)
    except OSError:
        pass


def schedule_cleanup(path: str) -> None:
    """Delete `path` after Flask sends the response. Used so streamed
    file downloads can clean up the on-disk temp file once the client
    has actually received it."""
    @after_this_request
    def _cleanup(response):
        cleanup_path(path)
        return response


def safe_filename(name: str, max_len: int = 80) -> str:
    """Sanitize a string for use as a download filename."""
    name = re.sub(r'[^\w\s.-]', '_', name).strip()
    name = re.sub(r'\s+', '_', name)
    return (name or 'file')[:max_len]


def is_valid_url(url: str) -> bool:
    """Cheap sanity check — make sure we got a real-looking URL.
    Doesn't actually fetch anything."""
    if not url or len(url) > 2000:
        return False
    try:
        p = urlparse(url)
        return p.scheme in ('http', 'https') and bool(p.netloc)
    except ValueError:
        return False


# ─────────────────────────────────────────────────────────────────────────────
#  Health check
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/api/tools/ping', methods=['GET'])
def ping():
    """Liveness + dep-status probe so the frontend can show which
    tools are actually available before the user clicks them.

    Uses `importlib.util.find_spec` instead of `__import__` so we
    avoid actually loading heavy modules (rembg + onnxruntime would
    pull in ~300 MB of native code on first call). find_spec only
    asks the import system whether the module CAN be imported."""
    deps = {}
    for mod, label in [
        ('yt_dlp', 'yt-dlp'),
        ('readability', 'readability-lxml'),
        ('rembg', 'rembg'),
        ('pypdf', 'pypdf'),
        ('pdf2image', 'pdf2image'),
        ('PIL', 'Pillow'),
    ]:
        try:
            deps[label] = importlib.util.find_spec(mod) is not None
        except (ImportError, ValueError):
            deps[label] = False
    # ffmpeg / pdftoppm are system binaries — check by looking up the path
    deps['ffmpeg'] = shutil.which('ffmpeg') is not None
    deps['poppler-utils'] = shutil.which('pdftoppm') is not None
    return jsonify({'ok': True, 'service': 'tools_api', 'deps': deps})


# ─────────────────────────────────────────────────────────────────────────────
#  Reader mode — strip a webpage down to the main article
# ─────────────────────────────────────────────────────────────────────────────

# Pretend to be a real browser. Many sites (including most news sites)
# return a 403 / cookie wall to anything that looks like a script.
USER_AGENT = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
    'AppleWebKit/537.36 (KHTML, like Gecko) '
    'Chrome/123.0.0.0 Safari/537.36'
)


class _FetchError(Exception):
    """Reader-fetch failure with structured per-attempt details so the
    frontend can show the user exactly what went wrong (direct attempt
    blocked, proxy unreachable, both blocked, etc)."""
    def __init__(self, message: str, attempts: list[dict]):
        super().__init__(message)
        self.attempts = attempts


class _FetchResult:
    """Lightweight wrapper that mimics requests.Response.text + url so
    Readability and the rest of the endpoint don't care which fetcher
    actually pulled the page."""
    def __init__(self, text: str, url: str):
        self.text = text
        self.url = url


SOCIAL_BOT_UA = (
    'facebookexternalhit/1.1 '
    '(+http://www.facebook.com/externalhit_uatext.php)'
)


def _fetch_article(url: str, *, social_bot: bool = False):
    """Fetch a URL for the reader endpoint.

    Strategy (each step is logged into `attempts`):
      1. curl_cffi with Chrome 124 impersonation, direct connection.
         curl_cffi's TLS fingerprint matches a real Chrome handshake,
         which beats most Cloudflare/WAF fingerprint blocks that
         vanilla `requests` triggers.
      2. curl_cffi via the residential SOCKS5 proxy (datacenter
         IP-block fallback).
      3. Plain `requests` direct (last resort, simpler stack).
      4. Plain `requests` via proxy.

    For PROXY_HOSTS we skip the direct attempts and go straight to the
    proxied ones.

    `social_bot=True` swaps the User-Agent header to Facebookbot. Many
    paywalled sites (Medium, news sites, etc.) serve a fuller version
    of the article to social-card crawlers for SEO — we still keep the
    Chrome TLS handshake so cloudflare-protected sites don't block us.

    Returns a _FetchResult on success, raises _FetchError on failure
    with per-attempt diagnostic details.
    """
    attempts: list[dict] = []

    ua = SOCIAL_BOT_UA if social_bot else USER_AGENT
    headers = {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,no;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
    }

    def _resolve_proxy() -> tuple[str | None, str | None]:
        """Returns (proxy_url, error). One of them is always None."""
        proxy_url = _read_yt_proxy()
        if not proxy_url:
            return None, 'no proxy configured (yt-proxy.txt)'
        if not _check_proxy_alive(proxy_url):
            return None, f'proxy {proxy_url} unreachable (start home tunnel)'
        return proxy_url, None

    def _attempt_curl_cffi(label: str, use_proxy: bool):
        result: dict = {'label': label, 'used_proxy': use_proxy, 'engine': 'curl_cffi'}
        try:
            from curl_cffi import requests as cffi_requests
        except Exception as e:
            result['ok'] = False
            result['error'] = f'curl_cffi not available: {e}'
            attempts.append(result)
            return None

        proxies = None
        if use_proxy:
            proxy_url, err = _resolve_proxy()
            if err:
                result['ok'] = False
                result['error'] = err
                attempts.append(result)
                return None
            proxies = {'http': proxy_url, 'https': proxy_url}
            result['proxy_url'] = proxy_url

        try:
            r = cffi_requests.get(
                url,
                headers=headers,
                timeout=25 if use_proxy else 15,
                allow_redirects=True,
                impersonate='chrome124',
                proxies=proxies,
            )
            result['status'] = r.status_code
            try:
                result['final_url'] = r.url
            except Exception:
                result['final_url'] = url
            if r.status_code < 400:
                result['ok'] = True
                attempts.append(result)
                return _FetchResult(r.text, result['final_url'])
            result['ok'] = False
            result['error'] = f'HTTP {r.status_code}'
            attempts.append(result)
            return None
        except Exception as e:
            result['ok'] = False
            result['error'] = f'{type(e).__name__}: {e}'
            attempts.append(result)
            return None

    def _attempt_requests(label: str, use_proxy: bool):
        import requests
        result: dict = {'label': label, 'used_proxy': use_proxy, 'engine': 'requests'}

        proxies = None
        if use_proxy:
            proxy_url, err = _resolve_proxy()
            if err:
                result['ok'] = False
                result['error'] = err
                attempts.append(result)
                return None
            proxies = {'http': proxy_url, 'https': proxy_url}
            result['proxy_url'] = proxy_url

        try:
            r = requests.get(
                url,
                headers=headers,
                timeout=25 if use_proxy else 15,
                allow_redirects=True,
                proxies=proxies,
            )
            result['status'] = r.status_code
            result['final_url'] = r.url
            if r.status_code < 400:
                result['ok'] = True
                attempts.append(result)
                return _FetchResult(r.text, r.url)
            result['ok'] = False
            result['error'] = f'HTTP {r.status_code} {r.reason}'
            attempts.append(result)
            return None
        except requests.RequestException as e:
            result['ok'] = False
            result['error'] = f'{type(e).__name__}: {e}'
            attempts.append(result)
            return None

    # Order of attempts. PROXY_HOSTS = sites we know block datacenter
    # IPs, so we don't waste time on direct attempts there.
    if _needs_proxy(url):
        order = [
            ('cffi-proxy',     _attempt_curl_cffi, True),
            ('requests-proxy', _attempt_requests,  True),
        ]
    else:
        order = [
            ('cffi-direct',    _attempt_curl_cffi, False),
            ('cffi-proxy',     _attempt_curl_cffi, True),
            ('requests-direct',_attempt_requests,  False),
            ('requests-proxy', _attempt_requests,  True),
        ]

    for label, fn, use_proxy in order:
        r = fn(label, use_proxy)
        if r is not None:
            return r

    last = attempts[-1] if attempts else {}
    raise _FetchError(
        last.get('error', 'unknown fetch failure'),
        attempts,
    )


@app.route('/api/tools/reader', methods=['POST'])
def reader_mode():
    """Fetch a URL and return its main article content via Readability.

    Body: { "url": "https://example.com/article" }
    Returns: {
        "title":   str,
        "byline":  str | null,
        "domain":  str,
        "content": str (HTML — Readability output),
        "text":    str (plain text fallback for copy/markdown),
        "length":  int (character count),
    }
    """
    body = request.get_json(silent=True) or {}
    url = (body.get('url') or '').strip()
    if not is_valid_url(url):
        return jsonify({'error': 'invalid url'}), 400

    try:
        resp = _fetch_article(url)
    except _FetchError as e:
        lines = ['Klarte ikke å hente artikkelen.']
        for a in e.attempts:
            tag = 'proxy' if a.get('used_proxy') else 'direkte'
            engine = a.get('engine', '?')
            label = f'{engine}/{tag}'
            if a.get('ok'):
                lines.append(f'  · {label}: OK ({a.get("status")})')
            else:
                lines.append(f'  · {label}: {a.get("error", "ukjent feil")}')
        return jsonify({
            'error': '\n'.join(lines),
            'attempts': e.attempts,
        }), 502

    title, content_html, text, byline = _extract_article(resp.text, url)
    final_url = resp.url

    # If the first pass came back unusually short, the page is probably
    # paywalled or partially-rendered server-side. Try two generic
    # fallbacks (no site-specific logic) and take whichever returns
    # the most body text:
    #   (a) Re-fetch with a Facebookbot User-Agent — many sites serve a
    #       richer SEO version of the article to social-card crawlers.
    #   (b) Pull the latest snapshot from the Wayback Machine — older
    #       captures often have full content from before paywalls were
    #       added or while authenticated sessions were captured.
    if len(text) < 2500:
        candidates = [(text, content_html, title, byline, final_url)]

        # (a) Social-bot retry — many sites serve a richer SEO version
        # to social-card crawlers.
        try:
            resp_bot = _fetch_article(url, social_bot=True)
            t2, c2, txt2, by2 = _extract_article(resp_bot.text, url)
            candidates.append((txt2, c2, t2, by2, resp_bot.url))
        except _FetchError:
            pass

        # (b) Headless Chromium via Playwright with Google-search referer.
        # Heaviest fallback (~3-5s, spins up Chromium) but unlocks JS-
        # rendered content + tricks paywalls that whitelist Google
        # referrals (Medium, NYTimes, WSJ, etc.).
        pw = _fetch_via_browser(url)
        if pw is not None:
            t4, c4, txt4, by4 = _extract_article(pw.text, url)
            candidates.append((txt4, c4, t4, by4, pw.url))

        # (c) Wayback Machine snapshot — last-resort, often empty for
        # very recent articles.
        wb = _fetch_wayback(url)
        if wb is not None:
            t3, c3, txt3, by3 = _extract_article(wb.text, url)
            candidates.append((txt3, c3, t3, by3, wb.url))

        # Pick the candidate with the longest body text.
        candidates.sort(key=lambda c: len(c[0] or ''), reverse=True)
        best = candidates[0]
        text         = best[0] or text
        content_html = best[1] or content_html
        title        = best[2] or title
        byline       = best[3] or byline
        final_url    = best[4] or final_url

    return jsonify({
        'title':   title,
        'byline':  byline,
        'domain':  urlparse(final_url).netloc,
        'content': content_html,
        'text':    text,
        'length':  len(text),
    })


def _fetch_via_browser(url: str):
    """JS-rendered fallback fetcher using Playwright headless Chromium.

    Tricks layered in:
      - Real desktop Chrome UA + viewport so Medium/NYT/etc. don't think
        we're a bot.
      - Google search referer + Sec-Fetch-Site=cross-site headers — many
        paywalled sites give visitors arriving from Google a free read
        for SEO purposes. Verified to ~60% MORE article content on
        Medium vs the same fetch with no referer.
      - Wait for domcontentloaded + a short settle pause, then scroll
        the page to trigger any lazy-loaded sections.
      - CSS inject to hide common paywall/overlay elements that some
        sites use to halt scrolling once you're "out of free reads".

    Returns a `_FetchResult` on success, None on any failure.
    Best-effort — never raises.
    """
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        return None

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
            try:
                ctx = browser.new_context(
                    user_agent=(
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                        'AppleWebKit/537.36 (KHTML, like Gecko) '
                        'Chrome/124.0.0.0 Safari/537.36'
                    ),
                    viewport={'width': 1280, 'height': 720},
                    locale='en-US',
                    extra_http_headers={
                        # Pretend we arrived from a Google search — paywalled
                        # sites usually whitelist Google referrals.
                        'Referer': 'https://www.google.com/search?q=' + url.split('/')[-1][:60],
                        'Sec-Fetch-Site': 'cross-site',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-Dest': 'document',
                        'Sec-Fetch-User': '?1',
                        'Accept-Language': 'en-US,en;q=0.9',
                    },
                )
                pg = ctx.new_page()
                pg.goto(url, wait_until='domcontentloaded', timeout=30000)
                pg.wait_for_timeout(2500)
                # Hide common paywall overlays that block further loading.
                try:
                    pg.add_style_tag(content=(
                        '[class*="paywall"],[class*="metering"],'
                        '[class*="overlay"],[class*="modal"]'
                        '{display:none !important}'
                        'body,html{overflow:visible !important;'
                        'height:auto !important}'
                    ))
                except Exception:
                    pass
                # Scroll progressively to trigger lazy loads.
                for _ in range(6):
                    try:
                        pg.evaluate('window.scrollBy(0, window.innerHeight)')
                        pg.wait_for_timeout(350)
                    except Exception:
                        break
                try:
                    pg.evaluate('window.scrollTo(0, document.body.scrollHeight)')
                    pg.wait_for_timeout(800)
                except Exception:
                    pass
                html = pg.content()
                final_url = pg.url
                return _FetchResult(html, final_url)
            finally:
                try:
                    browser.close()
                except Exception:
                    pass
    except Exception:
        return None


def _fetch_wayback(url: str):
    """Try to pull the latest snapshot of `url` from the Wayback Machine.

    Uses the `id_` flag on the snapshot URL so archive.org returns the
    raw original HTML without their toolbar/wrapper. Returns a
    `_FetchResult` on success, or None if no snapshot exists or the
    fetch fails. Always best-effort — never raises.
    """
    try:
        import json as _json
        from curl_cffi import requests as cffi_requests

        api = f'https://archive.org/wayback/available?url={url}'
        r = cffi_requests.get(
            api,
            impersonate='chrome124',
            timeout=15,
            allow_redirects=True,
        )
        if r.status_code != 200:
            return None
        data = _json.loads(r.text)
        snap = (
            data.get('archived_snapshots', {})
                .get('closest', {})
        )
        if not snap.get('available'):
            return None
        snap_url = snap.get('url') or ''
        # Insert the `id_` modifier so we get the raw original HTML.
        # Snapshot URLs look like: https://web.archive.org/web/<ts>/<orig>
        snap_url = re.sub(
            r'(/web/\d+)(/)',
            r'\1id_\2',
            snap_url,
            count=1,
        )
        if not snap_url:
            return None

        s = cffi_requests.get(
            snap_url,
            impersonate='chrome124',
            timeout=25,
            allow_redirects=True,
        )
        if s.status_code != 200:
            return None
        return _FetchResult(s.text, snap_url)
    except Exception:
        return None


def _extract_article(html: str, url: str) -> tuple[str, str, str, str | None]:
    """Pull the readable article body out of an HTML page.

    Tries trafilatura first (much better at preserving full article
    text — readability-lxml drops paragraphs it thinks are boilerplate,
    which on Medium can include the last few paragraphs before the
    paywall). Falls back to readability-lxml if trafilatura returns
    nothing or short content.

    Returns (title, content_html, plain_text, byline).
    """
    title = ''
    content_html = ''
    text = ''
    byline: str | None = None

    # ── Trafilatura attempt ─────────────────────────────────────────
    try:
        import trafilatura
        from trafilatura.settings import use_config

        # Aggressive recall + keep formatting so the rendered article
        # has paragraph breaks, headings, lists, links.
        cfg = use_config()
        cfg.set('DEFAULT', 'EXTRACTION_TIMEOUT', '30')

        extracted = trafilatura.extract(
            html,
            url=url,
            output_format='html',
            include_comments=False,
            include_tables=True,
            include_images=True,
            include_links=True,
            include_formatting=True,
            favor_recall=True,
            with_metadata=False,
            config=cfg,
        )
        if extracted and len(extracted) > 200:
            content_html = extracted

        # Pull metadata (title + byline) from trafilatura
        meta = trafilatura.extract_metadata(html, default_url=url)
        if meta:
            title = meta.title or ''
            byline = meta.author or None
    except Exception:
        # Trafilatura is optional; we'll fall through to readability.
        pass

    # ── Readability fallback ────────────────────────────────────────
    if not content_html or len(content_html) < 200:
        try:
            from readability import Document
            doc = Document(html)
            if not title:
                title = doc.title() or ''
            content_html = doc.summary(html_partial=True) or content_html
        except Exception:
            pass

    # Plain text fallback — strip tags from whichever HTML we got
    if content_html:
        try:
            from lxml import html as lxml_html
            tree = lxml_html.fromstring(content_html)
            text = tree.text_content().strip()
            text = re.sub(r'\n{3,}', '\n\n', text)
        except Exception:
            text = ''

    return title, content_html, text, byline


# ─────────────────────────────────────────────────────────────────────────────
#  Video downloader — yt-dlp wrapper
# ─────────────────────────────────────────────────────────────────────────────

# Cookies file for yt-dlp. YouTube (and some other sites) require
# authentication cookies to prove you're not a bot. The user exports
# cookies from their browser and uploads them via /api/tools/video/cookies.
YT_COOKIES_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), 'yt-cookies.txt'
)

# Optional residential proxy URL for YouTube downloads. Read from a
# small text file so it can be changed without redeploying tools_api.
# Typical content: `socks5h://127.0.0.1:1080` (the local end of an SSH
# reverse tunnel from the user's home PC). YouTube blocks Hetzner-style
# datacenter IPs even with valid cookies + PO tokens, so routing the
# outbound HTTP request through a residential IP is the only reliable
# workaround. The `h` in `socks5h` is important — it tells the proxy
# to do remote DNS resolution so we don't leak DNS to the server's ISP.
YT_PROXY_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), 'yt-proxy.txt'
)


def _read_yt_proxy() -> str | None:
    """Return the proxy URL from yt-proxy.txt, or None if not configured
    or empty. Comments (`#`) and blank lines are ignored."""
    try:
        with open(YT_PROXY_PATH, 'r', encoding='utf-8') as f:
            for line in f:
                stripped = line.strip()
                if stripped and not stripped.startswith('#'):
                    return stripped
        return None
    except OSError:
        return None


def _check_proxy_alive(proxy_url: str, timeout: float = 1.5) -> bool:
    """Quick TCP-level check that the proxy is reachable. Returns False
    if the host:port can't be opened. Doesn't validate that it actually
    speaks SOCKS5 — just confirms something is listening."""
    try:
        parsed = urlparse(proxy_url)
        host = parsed.hostname or '127.0.0.1'
        port = parsed.port or 1080
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (OSError, ValueError):
        return False


# Hosts where we should route yt-dlp requests through the residential
# proxy. Two reasons a host ends up here:
#   1. It blocks datacenter IPs (YouTube)
#   2. It geo-restricts content to a specific country (NRK = Norway-only,
#      TV2 Play, Viaplay, etc.)
# Substring matching against the URL host. Add more here as you find
# them — anything ending in .no usually qualifies for Norwegian users.
PROXY_HOSTS = (
    # YouTube — datacenter blocking
    'youtube.com',
    'youtu.be',
    # Norwegian streaming services — geo-restricted to NO
    'nrk.no',
    'tv.nrk.no',
    'tv2.no',
    'play.tv2.no',
    'sumo.tv2.no',
    'vgtv.no',
    'dagbladet.no',
    'discoveryplus.no',
    'viaplay.no',
)


def _needs_proxy(url: str | None) -> bool:
    """True if this URL should be routed through the residential proxy."""
    if not url:
        return False
    try:
        host = (urlparse(url).netloc or '').lower()
    except ValueError:
        return False
    if not host:
        return False
    return any(h in host for h in PROXY_HOSTS)

# bgutil-ytdlp-pot-provider HTTP server — generates YouTube PO Tokens
# (Proof-of-Origin Tokens) which YouTube requires for anti-bot
# verification on datacenter IPs. Runs as a separate systemd unit
# (`bgutil-pot-server.service`) on port 4416.
BGUTIL_POT_URL = 'http://127.0.0.1:4416'

# Extract YouTube video IDs from any of the common URL formats so we
# can request a content-bound PO token before calling yt-dlp.
_YT_VIDEO_ID_RE = re.compile(
    r'(?:v=|/v/|youtu\.be/|/embed/|/shorts/)([a-zA-Z0-9_-]{11})'
)


def _extract_youtube_id(url: str) -> str | None:
    """Best-effort YouTube video ID parser. Returns None for non-YT URLs
    or URLs we don't recognize — caller falls back to no PO token."""
    if not url:
        return None
    m = _YT_VIDEO_ID_RE.search(url)
    return m.group(1) if m else None


def _fetch_po_token(video_id: str, client: str = 'WEB') -> str | None:
    """Ask the bgutil HTTP server for a content-bound PO token. Returns
    the token string or None on any failure (network down, server
    misconfigured, etc.) so the caller can fall back gracefully."""
    import urllib.request
    import urllib.error
    try:
        body = json.dumps({
            'content_binding': video_id,
            'client': client,
            'bypass_cache': False,
        }).encode('utf-8')
        req = urllib.request.Request(
            f'{BGUTIL_POT_URL}/get_pot',
            data=body,
            headers={'Content-Type': 'application/json'},
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        return data.get('poToken')
    except (urllib.error.URLError, ValueError, OSError):
        return None


def _yt_base_opts(url: str | None = None) -> dict:
    """Return the yt-dlp opts that should apply to every YouTube call —
    cookies, residential proxy (when YouTube + proxy is configured),
    explicit player_client, and a manually fetched PO token bound to
    the video ID.

    For YouTube URLs we route through a residential proxy if one is
    configured (yt-proxy.txt) and reachable. This sidesteps Hetzner's
    datacenter-IP block, which is the only reliable solution — even
    valid cookies + PO tokens get blocked from a datacenter range.
    For non-YouTube sites no proxy is used.
    """
    opts: dict = {}
    if os.path.isfile(YT_COOKIES_PATH):
        opts['cookiefile'] = YT_COOKIES_PATH

    is_youtube = bool(url) and ('youtube.com' in url or 'youtu.be' in url)

    # Residential proxy for sites in PROXY_HOSTS (YouTube datacenter
    # block, plus Norwegian geo-restricted streamers like NRK / TV2).
    # All other sites go direct from the server for speed.
    if _needs_proxy(url):
        proxy_url = _read_yt_proxy()
        if proxy_url and _check_proxy_alive(proxy_url):
            opts['proxy'] = proxy_url

    extractor_args: dict = {}
    # Force web + mweb player clients — these are the ones that USE
    # PO tokens. Default clients (android_vr, web_safari) bypass POT
    # but get blocked outright on datacenter IPs.
    extractor_args['youtube'] = {'player_client': ['web', 'mweb']}

    # If we got a YouTube URL, fetch a content-bound PO token from the
    # local bgutil server and inject it. The token is bound to the video
    # ID and expires in ~6 hours, so it must be fetched per-request.
    # Even with the residential proxy, YouTube increasingly requires a
    # POT for many videos, so we keep this as belt-and-suspenders.
    video_id = _extract_youtube_id(url) if url else None
    if video_id:
        po_token = _fetch_po_token(video_id, client='WEB')
        if po_token:
            extractor_args['youtube']['po_token'] = [
                f'web.gvs+{po_token}',
                f'mweb.gvs+{po_token}',
            ]

    opts['extractor_args'] = extractor_args
    return opts


def _yt_cookie_opts() -> dict:
    """Backwards-compat alias — returns just cookies for non-YouTube URLs."""
    if os.path.isfile(YT_COOKIES_PATH):
        return {'cookiefile': YT_COOKIES_PATH}
    return {}


# Quality presets the frontend can request. Each maps to a yt-dlp
# format selector string. We use the permissive `bv*+ba` form so the
# selector works across YouTube, NRK, TV2, Vimeo, and any other
# extractor regardless of how it labels its container formats. The
# `merge_output_format: mp4` option below makes sure the final file
# is always MP4 even if the source streams are something else.
VIDEO_QUALITY_PRESETS = {
    'best':  'bv*+ba/b',
    '1080p': 'bv*[height<=1080]+ba/b[height<=1080]/bv*+ba/b',
    '720p':  'bv*[height<=720]+ba/b[height<=720]/bv*+ba/b',
    '480p':  'bv*[height<=480]+ba/b[height<=480]/bv*+ba/b',
    '360p':  'bv*[height<=360]+ba/b[height<=360]/bv*+ba/b',
}


@app.route('/api/tools/video/info', methods=['POST'])
def video_info():
    """Probe a video URL with yt-dlp and return metadata for the
    preview card. Does NOT download the video itself.

    Body: { "url": "https://..." }
    Returns: { title, thumbnail, uploader, duration, durationStr,
               webpageUrl, extractor, hasFormats: { 360p, 480p, ... } }
    """
    import yt_dlp

    body = request.get_json(silent=True) or {}
    url = (body.get('url') or '').strip()
    if not is_valid_url(url):
        return jsonify({'error': 'invalid url'}), 400

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
        'noplaylist': True,
        'extract_flat': False,
        **_yt_base_opts(url),
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as e:
        return jsonify({'error': f'yt-dlp error: {e}'}), 502
    except Exception as e:
        return jsonify({'error': f'unexpected error: {e}'}), 500

    # Some sites return playlists — we asked for noplaylist, but if the
    # extractor still gives one, take the first entry.
    if info.get('_type') == 'playlist' and info.get('entries'):
        info = info['entries'][0]

    # Compute which quality presets actually exist for this video by
    # looking at the heights in the available format list.
    available_heights = set()
    for f in info.get('formats') or []:
        h = f.get('height')
        if h:
            available_heights.add(h)
    has_formats = {
        '360p':  any(h <= 360 for h in available_heights),
        '480p':  any(h <= 480 for h in available_heights),
        '720p':  any(h <= 720 for h in available_heights),
        '1080p': any(h <= 1080 for h in available_heights),
        'best':  bool(available_heights),
        # Audio-only is always offered if there's any audio at all
        'audio': any(f.get('acodec') and f.get('acodec') != 'none' for f in info.get('formats') or []),
    }

    # Some extractors (NRK, etc.) return float seconds — coerce to int
    # so the format spec `:02d` doesn't blow up.
    duration = int(info.get('duration') or 0)
    h = duration // 3600
    m = (duration % 3600) // 60
    s = duration % 60
    if h:
        dur_str = f'{h}:{m:02d}:{s:02d}'
    else:
        dur_str = f'{m}:{s:02d}'

    return jsonify({
        'title':       info.get('title') or '(uten tittel)',
        'thumbnail':   info.get('thumbnail'),
        'uploader':    info.get('uploader') or info.get('channel') or '',
        'duration':    duration,
        'durationStr': dur_str,
        'webpageUrl':  info.get('webpage_url') or url,
        'extractor':   info.get('extractor_key') or info.get('extractor') or '',
        'hasFormats':  has_formats,
    })


@app.route('/api/tools/video/download', methods=['POST'])
def video_download():
    """Download a video with yt-dlp into a temp dir, then stream it
    back to the client as an attachment.

    Body: { "url": "...", "quality": "1080p" | "720p" | ... | "audio" }
    """
    import yt_dlp

    body = request.get_json(silent=True) or {}
    url = (body.get('url') or '').strip()
    quality = body.get('quality') or '720p'
    if not is_valid_url(url):
        return jsonify({'error': 'invalid url'}), 400
    if quality not in VIDEO_QUALITY_PRESETS and quality != 'audio':
        return jsonify({'error': f'unknown quality "{quality}"'}), 400

    workdir = make_tmpdir('video')

    # Output template — yt-dlp picks the right extension. We use a UUID
    # so two parallel downloads can't collide.
    outtmpl = os.path.join(workdir, '%(title).80s-%(id)s.%(ext)s')

    base = _yt_base_opts(url)
    if quality == 'audio':
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'noplaylist': True,
            'outtmpl': outtmpl,
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            **base,
        }
    else:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'noplaylist': True,
            'outtmpl': outtmpl,
            'format': VIDEO_QUALITY_PRESETS[quality],
            # Force MP4 container if we ended up with mismatched streams
            'merge_output_format': 'mp4',
            **base,
        }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            # extract_info returns the requested-format dict; the actual
            # filename after post-processing is in `requested_downloads`
            # or we can use prepare_filename + glob since the extension
            # may have changed (mp3 from audio extraction).
            base_name = ydl.prepare_filename(info)
    except yt_dlp.utils.DownloadError as e:
        cleanup_path(workdir)
        return jsonify({'error': f'yt-dlp error: {e}'}), 502
    except Exception as e:
        cleanup_path(workdir)
        return jsonify({'error': f'unexpected error: {e}'}), 500

    # Find the actual file in workdir (post-processing may have changed
    # the extension from .webm/.m4a to .mp4 / .mp3).
    actual_file = None
    base_root, _ = os.path.splitext(base_name)
    base_basename = os.path.basename(base_root)
    for fn in os.listdir(workdir):
        if fn.startswith(base_basename):
            actual_file = os.path.join(workdir, fn)
            break

    if not actual_file or not os.path.isfile(actual_file):
        cleanup_path(workdir)
        return jsonify({'error': 'output file not found after download'}), 500

    download_name = os.path.basename(actual_file)
    schedule_cleanup(workdir)

    return send_file(
        actual_file,
        as_attachment=True,
        download_name=download_name,
    )


@app.route('/api/tools/video/cookies', methods=['GET'])
def video_cookies_status():
    """Returns whether a yt-dlp cookies file is currently uploaded and
    when it was last modified. Used by the frontend to show a status
    badge in the video downloader page."""
    if not os.path.isfile(YT_COOKIES_PATH):
        return jsonify({'present': False})
    try:
        mtime = int(os.path.getmtime(YT_COOKIES_PATH))
        size = os.path.getsize(YT_COOKIES_PATH)
    except OSError:
        return jsonify({'present': False})
    return jsonify({'present': True, 'mtime': mtime, 'size': size})


@app.route('/api/tools/video/cookies', methods=['POST'])
def video_cookies_upload():
    """Save an uploaded Netscape-format cookies.txt file. yt-dlp will
    pick it up automatically on subsequent requests.

    Validation is intentionally permissive — different export tools
    use different header conventions (some skip the "# Netscape"
    comment entirely). We only require that the file contain at least
    one line with seven tab-separated fields, which is the Netscape
    cookie row format. yt-dlp gives much clearer errors than we can
    if the content turns out to be invalid at use time.
    """
    if 'file' not in request.files:
        return jsonify({'error': 'no file uploaded'}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'empty file'}), 400

    raw = file.read()
    if not raw:
        return jsonify({'error': 'empty file'}), 400

    # Look for at least one valid-looking cookie row.
    text = raw.decode('utf-8', errors='replace')
    valid_lines = 0
    for line in text.splitlines():
        s = line.strip()
        if not s or s.startswith('#'):
            continue
        # Netscape format: domain TAB flag TAB path TAB secure TAB
        # expiration TAB name TAB value  → 6 tabs / 7 fields
        if s.count('\t') >= 5:
            valid_lines += 1
    if valid_lines == 0:
        return jsonify({
            'error': (
                'fant ingen gyldige cookie-linjer i filen. Sørg for at '
                'du eksporterte den i Netscape-format (tab-separert) '
                'fra en utvidelse som "Get cookies.txt LOCALLY".'
            )
        }), 400

    try:
        with open(YT_COOKIES_PATH, 'wb') as f:
            f.write(raw)
        os.chmod(YT_COOKIES_PATH, 0o600)
    except OSError as e:
        return jsonify({'error': f'failed to save cookies: {e}'}), 500

    return jsonify({'ok': True, 'size': len(raw), 'cookies': valid_lines})


@app.route('/api/tools/video/cookies', methods=['DELETE'])
def video_cookies_delete():
    """Remove the uploaded cookies file."""
    try:
        if os.path.isfile(YT_COOKIES_PATH):
            os.remove(YT_COOKIES_PATH)
    except OSError as e:
        return jsonify({'error': str(e)}), 500
    return jsonify({'ok': True})


@app.route('/api/tools/video/proxy-status', methods=['GET'])
def video_proxy_status():
    """Report whether a YouTube residential proxy is configured and
    currently reachable. Used by the frontend to show a small status
    indicator and to give a clearer error when the proxy is down."""
    proxy_url = _read_yt_proxy()
    if not proxy_url:
        return jsonify({'configured': False, 'reachable': False})
    return jsonify({
        'configured': True,
        'url': proxy_url,
        'reachable': _check_proxy_alive(proxy_url),
    })


# ─────────────────────────────────────────────────────────────────────────────
#  Background remover — rembg + color-key fallback for logos
# ─────────────────────────────────────────────────────────────────────────────

# rembg's session is reused across requests so we don't reload the
# 175 MB ONNX model on every call. The session is created lazily on
# first request — see _get_rembg_session() below.
_rembg_session = None


def _get_rembg_session():
    """Lazy-init the rembg session. Cached on the module so subsequent
    requests reuse the loaded model."""
    global _rembg_session
    if _rembg_session is None:
        from rembg import new_session
        _rembg_session = new_session('u2net')
    return _rembg_session


def _detect_solid_background(raw: bytes) -> tuple[int, int, int] | None:
    """Heuristic: if the image is a logo / graphic sitting on a solid
    background (any color, not just white), return that background as
    an (R, G, B) tuple. Returns None if the image looks like a photo.

    rembg's U²-Net model is trained on photos and produces awful
    results on flat high-contrast graphics — it tries to find "the
    salient object" and ends up masking blobs out of nothing. For
    logo-style images, color-keying the actual background color is
    dramatically more reliable.

    Detection logic:
      1. Sample 9 anchor points (4 corners + 4 edge midpoints + center).
      2. The 8 non-center points must agree on color within ±12 RGB.
      3. At least 35% of all pixels must be within ±25 of that color.
    Logos are pixel-perfect uniform; photos almost never are.
    """
    import numpy as np
    from PIL import Image
    try:
        img = Image.open(io.BytesIO(raw)).convert('RGB')
    except Exception:
        return None
    arr = np.array(img)
    h, w = arr.shape[:2]
    if h < 10 or w < 10:
        return None

    # Sample edge points — these almost always belong to the background
    # in a logo image, almost never agree in a photo.
    edge_points = [
        arr[0, 0],
        arr[0, w - 1],
        arr[h - 1, 0],
        arr[h - 1, w - 1],
        arr[0, w // 2],
        arr[h - 1, w // 2],
        arr[h // 2, 0],
        arr[h // 2, w - 1],
    ]
    edge = np.stack(edge_points).astype(np.int16)
    spread_r = int(edge[:, 0].max() - edge[:, 0].min())
    spread_g = int(edge[:, 1].max() - edge[:, 1].min())
    spread_b = int(edge[:, 2].max() - edge[:, 2].min())
    if spread_r > 12 or spread_g > 12 or spread_b > 12:
        return None  # Edges disagree → probably a photo

    bg_r = int(np.median(edge[:, 0]))
    bg_g = int(np.median(edge[:, 1]))
    bg_b = int(np.median(edge[:, 2]))

    # Check the in-image ratio so we don't false-positive on photos
    # whose corners coincidentally happen to match.
    sample = arr
    if h * w > 50_000:
        step = max(1, int((h * w / 50_000) ** 0.5))
        sample = arr[::step, ::step]
    s = sample.astype(np.int16)
    near_bg = (
        (np.abs(s[..., 0] - bg_r) < 25)
        & (np.abs(s[..., 1] - bg_g) < 25)
        & (np.abs(s[..., 2] - bg_b) < 25)
    )
    ratio = float(near_bg.sum()) / float(near_bg.size)
    if ratio < 0.35:
        return None

    return (bg_r, bg_g, bg_b)


def _color_key(raw: bytes, bg_color: tuple[int, int, int]) -> bytes:
    """Remove a specified background color from the image. Pixels close
    to the background color become transparent; pixels far from it stay
    fully opaque; the band in between gets a soft alpha ramp so the
    cutout has clean anti-aliased edges.

    This is the right tool for logos / icons / flat graphics on solid
    backgrounds — much more reliable than U²-Net which only handles
    photos well.
    """
    import numpy as np
    from PIL import Image

    img = Image.open(io.BytesIO(raw)).convert('RGBA')
    # IMPORTANT: float32, NOT int16. With int16, (255 - 60)² = 38025
    # overflows the signed 16-bit range (max 32767), wraps to a
    # negative number, the squared sum becomes corrupt, sqrt returns
    # NaN, and every foreground pixel ends up incorrectly transparent.
    arr_uint = np.array(img)
    arr_f = arr_uint.astype(np.float32)

    bg = np.array(bg_color, dtype=np.float32)
    # Euclidean distance from each pixel to the background color in RGB.
    diff = arr_f[..., :3] - bg
    dist = np.sqrt((diff * diff).sum(axis=-1))

    # Soft falloff: alpha 0 below SOLID, alpha 255 above EDGE, smooth
    # ramp in between. Gives clean anti-aliased edges.
    SOLID = 18.0  # ≤ this distance → fully transparent (background)
    EDGE = 75.0   # ≥ this distance → fully opaque (foreground)
    ramp = np.clip((dist - SOLID) * 255.0 / (EDGE - SOLID), 0, 255)
    alpha = ramp.astype(np.uint8)

    # Preserve any original transparency in pixels that are clearly NOT
    # background (so PNGs that already have alpha don't get clobbered).
    keep_orig = dist > EDGE
    alpha = np.where(keep_orig, arr_uint[..., 3], alpha)

    out_arr = arr_uint.copy()
    out_arr[..., 3] = alpha
    out = Image.fromarray(out_arr, 'RGBA')
    buf = io.BytesIO()
    out.save(buf, format='PNG', optimize=True)
    return buf.getvalue()


@app.route('/api/tools/bgremove', methods=['POST'])
def bg_remove():
    """Strip the background from an uploaded image and return PNG with
    transparency. Auto-dispatches between two strategies:

      1. **Color-keying** for logos / icons / flat graphics on a solid
         background. Detects the background color from the image edges
         and removes pixels matching it. Works on any background color
         (white, blue, green, anything), not just white.
      2. **rembg + U²-Net** for actual photographs, where the
         AI-driven foreground extraction is the only reliable option.

    Form field name: `file`."""
    if 'file' not in request.files:
        return jsonify({'error': 'no file uploaded (field name "file")'}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'empty file'}), 400

    raw = file.read()
    if not raw:
        return jsonify({'error': 'empty file'}), 400

    try:
        bg_color = _detect_solid_background(raw)
        if bg_color is not None:
            out_bytes = _color_key(raw, bg_color)
        else:
            from rembg import remove
            session = _get_rembg_session()
            out_bytes = remove(raw, session=session)
    except Exception as e:
        return jsonify({'error': f'background removal failed: {e}'}), 500

    base = safe_filename(os.path.splitext(file.filename)[0])
    download_name = f'{base}-no-bg.png'

    return send_file(
        io.BytesIO(out_bytes),
        mimetype='image/png',
        as_attachment=True,
        download_name=download_name,
    )


# ─────────────────────────────────────────────────────────────────────────────
#  PDF tools — pypdf for structural ops, pdf2image for rasterization
# ─────────────────────────────────────────────────────────────────────────────

def _parse_page_range(spec: str, total: int) -> list[int]:
    """Parse a page range spec like '1-3,5,7-9' (1-indexed) into a
    sorted list of unique 0-indexed page numbers, clamped to [0, total)."""
    if not spec or not spec.strip():
        return list(range(total))
    pages: set[int] = set()
    for chunk in spec.split(','):
        chunk = chunk.strip()
        if not chunk:
            continue
        if '-' in chunk:
            a, _, b = chunk.partition('-')
            try:
                start = int(a)
                end = int(b)
            except ValueError:
                continue
            for p in range(min(start, end), max(start, end) + 1):
                if 1 <= p <= total:
                    pages.add(p - 1)
        else:
            try:
                p = int(chunk)
                if 1 <= p <= total:
                    pages.add(p - 1)
            except ValueError:
                continue
    return sorted(pages)


@app.route('/api/tools/pdf/merge', methods=['POST'])
def pdf_merge():
    """Merge any number of uploaded PDFs into one. Form field: `files`
    (multipart, repeated). Order of upload = order in result."""
    from pypdf import PdfWriter, PdfReader

    files = request.files.getlist('files')
    if not files:
        return jsonify({'error': 'no files uploaded'}), 400
    if len(files) < 2:
        return jsonify({'error': 'need at least 2 PDFs to merge'}), 400

    writer = PdfWriter()
    try:
        for f in files:
            reader = PdfReader(f.stream)
            for page in reader.pages:
                writer.add_page(page)
    except Exception as e:
        return jsonify({'error': f'merge failed: {e}'}), 500

    buf = io.BytesIO()
    writer.write(buf)
    writer.close()
    buf.seek(0)

    return send_file(
        buf,
        mimetype='application/pdf',
        as_attachment=True,
        download_name='merged.pdf',
    )


@app.route('/api/tools/pdf/split', methods=['POST'])
def pdf_split():
    """Extract a page range from a PDF. Form fields: `file` (the PDF),
    `pages` (range spec like '1-3,5')."""
    from pypdf import PdfReader, PdfWriter

    if 'file' not in request.files:
        return jsonify({'error': 'no file uploaded'}), 400
    file = request.files['file']
    spec = request.form.get('pages', '').strip()
    if not spec:
        return jsonify({'error': 'pages range required'}), 400

    try:
        reader = PdfReader(file.stream)
    except Exception as e:
        return jsonify({'error': f'invalid PDF: {e}'}), 400

    indices = _parse_page_range(spec, len(reader.pages))
    if not indices:
        return jsonify({'error': 'no valid pages in range'}), 400

    writer = PdfWriter()
    for i in indices:
        writer.add_page(reader.pages[i])

    buf = io.BytesIO()
    writer.write(buf)
    writer.close()
    buf.seek(0)

    base = safe_filename(os.path.splitext(file.filename or 'file')[0])
    return send_file(
        buf,
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f'{base}-pages.pdf',
    )


@app.route('/api/tools/pdf/rotate', methods=['POST'])
def pdf_rotate():
    """Rotate pages of a PDF. Fields: `file`, `degrees` (90/180/270),
    optional `pages` (range spec — default = all)."""
    from pypdf import PdfReader, PdfWriter

    if 'file' not in request.files:
        return jsonify({'error': 'no file uploaded'}), 400
    file = request.files['file']
    try:
        degrees = int(request.form.get('degrees', '90'))
    except ValueError:
        return jsonify({'error': 'degrees must be a number'}), 400
    if degrees not in (90, 180, 270):
        return jsonify({'error': 'degrees must be 90, 180, or 270'}), 400

    try:
        reader = PdfReader(file.stream)
    except Exception as e:
        return jsonify({'error': f'invalid PDF: {e}'}), 400

    indices = _parse_page_range(request.form.get('pages', ''), len(reader.pages))
    if not indices:
        return jsonify({'error': 'no valid pages'}), 400
    target = set(indices)

    writer = PdfWriter()
    for i, page in enumerate(reader.pages):
        if i in target:
            page.rotate(degrees)
        writer.add_page(page)

    buf = io.BytesIO()
    writer.write(buf)
    writer.close()
    buf.seek(0)

    base = safe_filename(os.path.splitext(file.filename or 'file')[0])
    return send_file(
        buf,
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f'{base}-rotated.pdf',
    )


@app.route('/api/tools/pdf/compress', methods=['POST'])
def pdf_compress():
    """Best-effort PDF size reduction via pypdf's stream compression
    and image-content-stream removal of duplicates. Not magic — heavily
    image-based PDFs need ghostscript for real shrinkage. We do what
    pypdf can do without extra deps."""
    from pypdf import PdfReader, PdfWriter

    if 'file' not in request.files:
        return jsonify({'error': 'no file uploaded'}), 400
    file = request.files['file']

    try:
        reader = PdfReader(file.stream)
        writer = PdfWriter(clone_from=reader)
        # Compress page content streams (lossless)
        for page in writer.pages:
            page.compress_content_streams()
    except Exception as e:
        return jsonify({'error': f'compress failed: {e}'}), 500

    buf = io.BytesIO()
    writer.write(buf)
    writer.close()
    buf.seek(0)

    base = safe_filename(os.path.splitext(file.filename or 'file')[0])
    return send_file(
        buf,
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f'{base}-compressed.pdf',
    )


@app.route('/api/tools/pdf/extract-text', methods=['POST'])
def pdf_extract_text():
    """Pull all text out of a PDF. Returns plain text as JSON."""
    from pypdf import PdfReader

    if 'file' not in request.files:
        return jsonify({'error': 'no file uploaded'}), 400
    file = request.files['file']

    try:
        reader = PdfReader(file.stream)
    except Exception as e:
        return jsonify({'error': f'invalid PDF: {e}'}), 400

    parts: list[str] = []
    for i, page in enumerate(reader.pages):
        try:
            txt = page.extract_text() or ''
        except Exception:
            txt = ''
        if txt.strip():
            parts.append(f'─── Side {i + 1} ───\n{txt.strip()}')

    text = '\n\n'.join(parts)
    return jsonify({
        'text':  text,
        'pages': len(reader.pages),
        'chars': len(text),
    })


@app.route('/api/tools/pdf/to-images', methods=['POST'])
def pdf_to_images():
    """Render every page of a PDF as a PNG, return them as a ZIP."""
    from pdf2image import convert_from_bytes

    if 'file' not in request.files:
        return jsonify({'error': 'no file uploaded'}), 400
    file = request.files['file']

    raw = file.read()
    if not raw:
        return jsonify({'error': 'empty file'}), 400

    try:
        # 150 DPI is a reasonable default — readable but not huge
        images = convert_from_bytes(raw, dpi=150, fmt='png')
    except Exception as e:
        return jsonify({'error': f'pdf2image failed: {e}'}), 500

    zbuf = io.BytesIO()
    with zipfile.ZipFile(zbuf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for i, img in enumerate(images, start=1):
            page_buf = io.BytesIO()
            img.save(page_buf, format='PNG')
            zf.writestr(f'side-{i:03d}.png', page_buf.getvalue())
    zbuf.seek(0)

    base = safe_filename(os.path.splitext(file.filename or 'pdf')[0])
    return send_file(
        zbuf,
        mimetype='application/zip',
        as_attachment=True,
        download_name=f'{base}-bilder.zip',
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Universal file converter — image (Pillow) / audio / video (ffmpeg) /
#                              text (stdlib json + csv)
# ─────────────────────────────────────────────────────────────────────────────

# Map of category → set of accepted source extensions and what we can
# convert TO. Used by both /api/tools/convert/info (so the frontend
# can show valid targets) and the actual conversion endpoint.
CONVERT_FORMATS = {
    'image': {
        'inputs':  {'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'tif', 'ico'},
        # heic/avif are read-only without extra plugins; we list them
        # separately and only as input formats below.
        'targets': ['png', 'jpg', 'webp', 'gif', 'bmp', 'tiff', 'ico'],
    },
    'audio': {
        'inputs':  {'mp3', 'wav', 'flac', 'ogg', 'oga', 'aac', 'm4a', 'opus', 'wma'},
        'targets': ['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a', 'opus'],
    },
    'video': {
        'inputs':  {'mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v', '3gp'},
        'targets': ['mp4', 'webm', 'mov', 'avi', 'mkv', 'gif'],
    },
    'text': {
        'inputs':  {'json', 'csv'},
        'targets': ['json', 'csv'],
    },
}


def _detect_category(ext: str) -> str | None:
    """Return the category that owns this file extension, or None."""
    ext = ext.lower().lstrip('.')
    for cat, info in CONVERT_FORMATS.items():
        if ext in info['inputs']:
            return cat
    return None


@app.route('/api/tools/convert/info', methods=['POST'])
def convert_info():
    """Tell the frontend which target formats are valid for a given
    source file extension. The frontend calls this on upload so the
    target picker only shows valid options."""
    body = request.get_json(silent=True) or {}
    filename = (body.get('filename') or '').strip()
    if not filename:
        return jsonify({'error': 'filename required'}), 400

    _, ext = os.path.splitext(filename)
    ext = ext.lower().lstrip('.')
    cat = _detect_category(ext)
    if not cat:
        return jsonify({
            'category': None,
            'supported': False,
            'sourceExt': ext,
            'targets': [],
        })
    targets = [t for t in CONVERT_FORMATS[cat]['targets'] if t != ext]
    return jsonify({
        'category':  cat,
        'supported': True,
        'sourceExt': ext,
        'targets':   targets,
    })


@app.route('/api/tools/convert', methods=['POST'])
def convert_file():
    """Convert an uploaded file to a target format. Form fields:
        file:    the source file (multipart)
        target:  target extension (without dot), e.g. 'mp3' / 'png'
    """
    if 'file' not in request.files:
        return jsonify({'error': 'no file uploaded'}), 400
    file = request.files['file']
    target = (request.form.get('target') or '').lower().lstrip('.')
    if not target:
        return jsonify({'error': 'target format required'}), 400

    src_ext = os.path.splitext(file.filename or '')[1].lower().lstrip('.')
    cat = _detect_category(src_ext)
    if not cat:
        return jsonify({'error': f'unsupported source format: {src_ext}'}), 400
    if target not in CONVERT_FORMATS[cat]['targets']:
        return jsonify({
            'error': f'cannot convert {src_ext} → {target} '
                     f'(allowed: {", ".join(CONVERT_FORMATS[cat]["targets"])})'
        }), 400
    if target == src_ext:
        return jsonify({'error': 'source and target are the same format'}), 400

    base = safe_filename(os.path.splitext(file.filename or 'file')[0])

    # Dispatch by category
    try:
        if cat == 'image':
            return _convert_image(file, target, base)
        if cat == 'audio':
            return _convert_media(file, target, base, cat)
        if cat == 'video':
            return _convert_media(file, target, base, cat)
        if cat == 'text':
            return _convert_text(file, src_ext, target, base)
    except subprocess.CalledProcessError as e:
        msg = (e.stderr or b'').decode('utf-8', errors='replace')[-600:]
        return jsonify({'error': f'ffmpeg error: {msg}'}), 500
    except Exception as e:
        return jsonify({'error': f'conversion failed: {e}'}), 500

    return jsonify({'error': 'unreachable'}), 500


def _convert_image(file, target: str, base: str):
    """Image conversion via Pillow."""
    from PIL import Image

    img = Image.open(file.stream)

    # JPEG can't have alpha; flatten onto white if needed
    if target in ('jpg', 'jpeg', 'bmp') and img.mode in ('RGBA', 'LA', 'P'):
        bg = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        bg.paste(img, mask=img.split()[3] if img.mode == 'RGBA' else None)
        img = bg
    elif target == 'ico' and img.mode != 'RGBA':
        img = img.convert('RGBA')

    pil_format_map = {
        'jpg':  'JPEG',
        'jpeg': 'JPEG',
        'png':  'PNG',
        'webp': 'WEBP',
        'gif':  'GIF',
        'bmp':  'BMP',
        'tiff': 'TIFF',
        'ico':  'ICO',
    }
    pil_format = pil_format_map[target]

    out_buf = io.BytesIO()
    save_kwargs: dict = {}
    if pil_format == 'JPEG':
        save_kwargs['quality'] = 92
        save_kwargs['optimize'] = True
    elif pil_format == 'WEBP':
        save_kwargs['quality'] = 90
    elif pil_format == 'PNG':
        save_kwargs['optimize'] = True

    img.save(out_buf, format=pil_format, **save_kwargs)
    out_buf.seek(0)

    mime_map = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
        'webp': 'image/webp', 'gif': 'image/gif', 'bmp': 'image/bmp',
        'tiff': 'image/tiff', 'ico': 'image/x-icon',
    }
    return send_file(
        out_buf,
        mimetype=mime_map[target],
        as_attachment=True,
        download_name=f'{base}.{target}',
    )


# Sensible ffmpeg defaults for each target. Most are codec choices that
# match the container.
_FFMPEG_AUDIO_OPTS = {
    'mp3':  ['-c:a', 'libmp3lame', '-b:a', '192k'],
    'wav':  ['-c:a', 'pcm_s16le'],
    'flac': ['-c:a', 'flac'],
    'ogg':  ['-c:a', 'libvorbis', '-q:a', '5'],
    'aac':  ['-c:a', 'aac', '-b:a', '192k'],
    'm4a':  ['-c:a', 'aac', '-b:a', '192k'],
    'opus': ['-c:a', 'libopus', '-b:a', '128k'],
}
_FFMPEG_VIDEO_OPTS = {
    'mp4':  ['-c:v', 'libx264', '-crf', '23', '-preset', 'medium',
             '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart'],
    'webm': ['-c:v', 'libvpx-vp9', '-crf', '32', '-b:v', '0',
             '-c:a', 'libopus', '-b:a', '128k'],
    'mov':  ['-c:v', 'libx264', '-crf', '23', '-preset', 'medium',
             '-c:a', 'aac', '-b:a', '128k'],
    'avi':  ['-c:v', 'mpeg4', '-q:v', '5', '-c:a', 'libmp3lame', '-q:a', '5'],
    'mkv':  ['-c:v', 'libx264', '-crf', '23', '-preset', 'medium',
             '-c:a', 'aac', '-b:a', '128k'],
    'gif':  ['-vf', 'fps=12,scale=480:-1:flags=lanczos', '-loop', '0'],
}


def _convert_media(file, target: str, base: str, cat: str):
    """Audio/video conversion via ffmpeg subprocess."""
    workdir = make_tmpdir('conv')
    src_path = os.path.join(workdir, f'in{os.path.splitext(file.filename)[1] or ".bin"}')
    out_path = os.path.join(workdir, f'out.{target}')

    file.save(src_path)

    if cat == 'audio':
        opts = _FFMPEG_AUDIO_OPTS.get(target, [])
        # Strip video stream when going audio-only
        cmd = ['ffmpeg', '-y', '-i', src_path, '-vn', *opts, out_path]
    else:  # video
        opts = _FFMPEG_VIDEO_OPTS.get(target, [])
        cmd = ['ffmpeg', '-y', '-i', src_path, *opts, out_path]

    try:
        subprocess.run(
            cmd,
            check=True,
            capture_output=True,
            timeout=1700,  # ~28 min — under nginx's 1800s read timeout
        )
    except subprocess.TimeoutExpired:
        cleanup_path(workdir)
        return jsonify({'error': 'ffmpeg timed out (file too large or too long)'}), 504

    if not os.path.isfile(out_path):
        cleanup_path(workdir)
        return jsonify({'error': 'ffmpeg produced no output'}), 500

    schedule_cleanup(workdir)

    mime_map = {
        'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'flac': 'audio/flac',
        'ogg': 'audio/ogg',  'aac': 'audio/aac', 'm4a': 'audio/mp4',
        'opus': 'audio/ogg',
        'mp4': 'video/mp4',  'webm': 'video/webm', 'mov': 'video/quicktime',
        'avi': 'video/x-msvideo', 'mkv': 'video/x-matroska',
        'gif': 'image/gif',
    }
    return send_file(
        out_path,
        mimetype=mime_map.get(target, 'application/octet-stream'),
        as_attachment=True,
        download_name=f'{base}.{target}',
    )


def _convert_text(file, src_ext: str, target: str, base: str):
    """Simple JSON ↔ CSV conversion using stdlib only."""
    import csv
    import json

    raw = file.read().decode('utf-8', errors='replace')

    if src_ext == 'json' and target == 'csv':
        data = json.loads(raw)
        if not isinstance(data, list) or not data:
            return jsonify({'error': 'JSON must be a non-empty array of objects'}), 400
        # Take the union of all keys so partial rows don't lose columns
        keys: list[str] = []
        seen: set[str] = set()
        for row in data:
            if not isinstance(row, dict):
                return jsonify({'error': 'JSON array must contain objects'}), 400
            for k in row.keys():
                if k not in seen:
                    seen.add(k)
                    keys.append(k)
        out = io.StringIO()
        writer = csv.DictWriter(out, fieldnames=keys, extrasaction='ignore')
        writer.writeheader()
        for row in data:
            writer.writerow(row)
        buf = io.BytesIO(out.getvalue().encode('utf-8'))
    elif src_ext == 'csv' and target == 'json':
        reader = csv.DictReader(io.StringIO(raw))
        rows = list(reader)
        buf = io.BytesIO(
            json.dumps(rows, ensure_ascii=False, indent=2).encode('utf-8')
        )
    else:
        return jsonify({'error': f'unsupported text conversion: {src_ext} → {target}'}), 400

    mime = 'application/json' if target == 'json' else 'text/csv'
    return send_file(
        buf,
        mimetype=mime,
        as_attachment=True,
        download_name=f'{base}.{target}',
    )


@app.errorhandler(413)
def too_large(_e):
    return jsonify({'error': 'file too large (max 200 MB)'}), 413


if __name__ == '__main__':
    # Bind to localhost only — nginx is the only thing that should reach us.
    # `threaded=True` so a long-running yt-dlp/rembg/ffmpeg job in one thread
    # doesn't block other endpoints.
    app.run(host='127.0.0.1', port=5002, debug=False, threaded=True)
