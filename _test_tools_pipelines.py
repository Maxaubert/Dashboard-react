#!/usr/bin/env python3
"""
End-to-end smoke tests for the PDF and Universal Converter endpoints
in tools_api.py.

Strategy:
  1. SSH into the server.
  2. Push a self-contained Python test script to /tmp on the server.
  3. The remote script generates real fixtures (PDFs via pypdf,
     PNG/JPEG via Pillow, WAV/MP4 via ffmpeg, JSON/CSV inline).
  4. It hits every endpoint via curl on 127.0.0.1:5002 (bypassing nginx
     auth).
  5. It validates each response: HTTP status, file magic bytes,
     and where possible re-parses the result (e.g. opens the merged
     PDF and checks page count).
  6. Prints a PASS/FAIL line per test plus a final summary.

Run from dashboard-react/:
    python _test_tools_pipelines.py
"""
import io
import os
import sys
import paramiko

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

HERE = os.path.dirname(os.path.abspath(__file__))


def load_creds() -> dict:
    creds: dict = {}
    with open(os.path.join(HERE, 'dashboard.txt'), 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if '=' in line:
                k, v = line.split('=', 1)
                creds[k.strip()] = v.strip()
    return creds


# ─────────────────────────────────────────────────────────────────────────────
# Remote test runner — uploaded to /tmp and executed there.
# Everything between the triple quotes runs ON THE SERVER as www-data has
# read access to /tmp; we run it as root via SSH which is fine for tests.
# ─────────────────────────────────────────────────────────────────────────────
REMOTE = r'''
import os, sys, json, subprocess, tempfile, shutil, struct, zipfile, io

BASE = 'http://127.0.0.1:5002/api/tools'
WORK = tempfile.mkdtemp(prefix='toolstest_')
results = []   # list of (name, ok, detail)

def log(name, ok, detail=''):
    results.append((name, ok, detail))
    mark = 'PASS' if ok else 'FAIL'
    print(f'  [{mark}] {name}{(" — " + detail) if detail else ""}', flush=True)

def section(t):
    print(f'\n── {t}', flush=True)

def curl_multipart(endpoint, fields, out_path=None):
    """Run curl against the local Flask. fields is a list of
    (kind, name, value) where kind is 'F' (field) or 'FILE'."""
    cmd = ['curl', '-s', '-S', '-w', '\\n%{http_code}', '-X', 'POST']
    for kind, name, val in fields:
        if kind == 'F':
            cmd += ['-F', f'{name}={val}']
        else:  # FILE
            cmd += ['-F', f'{name}=@{val}']
    if out_path:
        cmd += ['-o', out_path]
    cmd += [BASE + endpoint]
    p = subprocess.run(cmd, capture_output=True)
    body = p.stdout.decode('utf-8', errors='replace')
    # When -o is used, body is just the trailing http_code line
    if out_path:
        code = body.strip().splitlines()[-1] if body.strip() else '?'
        return int(code) if code.isdigit() else 0, ''
    # Otherwise body is response + newline + http_code
    *resp_lines, code_line = body.split('\n')
    return int(code_line) if code_line.isdigit() else 0, '\n'.join(resp_lines)

def curl_json(endpoint, payload):
    p = subprocess.run(
        ['curl', '-s', '-S', '-w', '\\n%{http_code}', '-X', 'POST',
         '-H', 'Content-Type: application/json',
         '-d', json.dumps(payload),
         BASE + endpoint],
        capture_output=True,
    )
    body = p.stdout.decode('utf-8', errors='replace')
    *resp_lines, code_line = body.split('\n')
    return int(code_line) if code_line.isdigit() else 0, '\n'.join(resp_lines)

# ── Fixture generation ───────────────────────────────────────────────────
def make_pdf(path, pages=3, label='Test'):
    from pypdf import PdfWriter
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    # reportlab may not be installed — fall back to pypdf-only blank pages
    try:
        c = canvas.Canvas(path, pagesize=letter)
        for i in range(1, pages + 1):
            c.setFont('Helvetica', 32)
            c.drawString(100, 700, f'{label} side {i}')
            c.drawString(100, 650, 'The quick brown fox jumps over the lazy dog.')
            c.showPage()
        c.save()
        return 'reportlab'
    except Exception:
        from pypdf import PdfWriter
        w = PdfWriter()
        for _ in range(pages):
            w.add_blank_page(width=595, height=842)
        with open(path, 'wb') as f:
            w.write(f)
        return 'blank'

def make_png(path, w=64, h=64, color=(200, 100, 50)):
    from PIL import Image
    Image.new('RGB', (w, h), color).save(path, format='PNG')

def make_jpg(path, w=64, h=64, color=(50, 100, 200)):
    from PIL import Image
    Image.new('RGB', (w, h), color).save(path, format='JPEG', quality=90)

def make_png_alpha(path):
    from PIL import Image
    img = Image.new('RGBA', (32, 32), (255, 0, 0, 128))
    img.save(path, format='PNG')

def make_wav(path, secs=1):
    subprocess.run(
        ['ffmpeg', '-y', '-f', 'lavfi', '-i', f'sine=frequency=440:duration={secs}',
         '-ar', '44100', '-ac', '1', path],
        check=True, capture_output=True,
    )

def make_mp4(path, secs=1):
    subprocess.run(
        ['ffmpeg', '-y', '-f', 'lavfi', '-i', f'testsrc=duration={secs}:size=160x120:rate=10',
         '-f', 'lavfi', '-i', f'sine=frequency=440:duration={secs}',
         '-c:v', 'libx264', '-c:a', 'aac', '-shortest', path],
        check=True, capture_output=True,
    )

# ── Build fixtures ───────────────────────────────────────────────────────
section('Generating fixtures')
pdf_a = os.path.join(WORK, 'a.pdf'); kind_a = make_pdf(pdf_a, pages=3, label='Alfa')
pdf_b = os.path.join(WORK, 'b.pdf'); kind_b = make_pdf(pdf_b, pages=2, label='Beta')
print(f'  pdf fixtures via: {kind_a}/{kind_b}', flush=True)
png   = os.path.join(WORK, 'pic.png'); make_png(png)
jpg   = os.path.join(WORK, 'pic.jpg'); make_jpg(jpg)
pnga  = os.path.join(WORK, 'alpha.png'); make_png_alpha(pnga)
wav   = os.path.join(WORK, 'tone.wav'); make_wav(wav)
mp4   = os.path.join(WORK, 'clip.mp4'); make_mp4(mp4)
jsonp = os.path.join(WORK, 'rows.json')
with open(jsonp, 'w') as f:
    json.dump([{'name':'Ada','age':30},{'name':'Bo','age':25,'city':'Oslo'}], f)
csvp  = os.path.join(WORK, 'rows.csv')
with open(csvp, 'w') as f:
    f.write('name,age\nAda,30\nBo,25\n')
print(f'  fixtures dir: {WORK}', flush=True)

# ── PING ─────────────────────────────────────────────────────────────────
section('Ping')
p = subprocess.run(['curl','-s','-w','\\n%{http_code}', BASE + '/ping'], capture_output=True)
body = p.stdout.decode('utf-8','replace')
*resp, code = body.split('\n')
log('GET /ping', code == '200', f'http={code}')

# ── PDF: merge ───────────────────────────────────────────────────────────
section('PDF endpoints')
out = os.path.join(WORK, 'merged.pdf')
code, _ = curl_multipart('/pdf/merge',
    [('FILE','files',pdf_a),('FILE','files',pdf_b)], out_path=out)
ok = code == 200 and os.path.getsize(out) > 0
detail = f'http={code} size={os.path.getsize(out) if os.path.exists(out) else 0}'
if ok:
    try:
        from pypdf import PdfReader
        n = len(PdfReader(out).pages)
        ok = n == 5
        detail += f' pages={n} (expected 5)'
    except Exception as e:
        ok = False
        detail += f' parse-error={e}'
log('POST /pdf/merge (3 + 2 → 5 pages)', ok, detail)

# ── PDF: split ───────────────────────────────────────────────────────────
out = os.path.join(WORK, 'split.pdf')
code, _ = curl_multipart('/pdf/split',
    [('FILE','file',pdf_a),('F','pages','1-2')], out_path=out)
ok = code == 200
detail = f'http={code}'
if ok:
    try:
        from pypdf import PdfReader
        n = len(PdfReader(out).pages)
        ok = n == 2
        detail += f' pages={n} (expected 2)'
    except Exception as e:
        ok = False; detail += f' parse-error={e}'
log('POST /pdf/split (range 1-2 of 3-page pdf)', ok, detail)

# Out-of-range page
code, body = curl_multipart('/pdf/split',
    [('FILE','file',pdf_a),('F','pages','99')])
log('POST /pdf/split (invalid range → 400)', code == 400, f'http={code}')

# ── PDF: rotate ──────────────────────────────────────────────────────────
out = os.path.join(WORK, 'rot.pdf')
code, _ = curl_multipart('/pdf/rotate',
    [('FILE','file',pdf_a),('F','degrees','90')], out_path=out)
ok = code == 200
detail = f'http={code}'
if ok:
    try:
        from pypdf import PdfReader
        r = PdfReader(out)
        rot = r.pages[0].get('/Rotate', 0)
        ok = int(rot) == 90
        detail += f' rotate={rot} (expected 90)'
    except Exception as e:
        ok = False; detail += f' parse-error={e}'
log('POST /pdf/rotate (90°)', ok, detail)

# Bad degrees
code, _ = curl_multipart('/pdf/rotate',
    [('FILE','file',pdf_a),('F','degrees','45')])
log('POST /pdf/rotate (invalid degrees → 400)', code == 400, f'http={code}')

# ── PDF: compress ────────────────────────────────────────────────────────
out = os.path.join(WORK, 'comp.pdf')
code, _ = curl_multipart('/pdf/compress',
    [('FILE','file',pdf_a)], out_path=out)
ok = code == 200 and os.path.getsize(out) > 0
src_sz = os.path.getsize(pdf_a)
out_sz = os.path.getsize(out) if os.path.exists(out) else 0
detail = f'http={code} {src_sz}B → {out_sz}B'
if ok:
    try:
        from pypdf import PdfReader
        n = len(PdfReader(out).pages)
        ok = n == 3
        detail += f' pages={n}'
    except Exception as e:
        ok = False; detail += f' parse-error={e}'
log('POST /pdf/compress', ok, detail)

# ── PDF: extract text ────────────────────────────────────────────────────
code, body = curl_multipart('/pdf/extract-text', [('FILE','file',pdf_a)])
ok = code == 200
detail = f'http={code}'
if ok:
    try:
        d = json.loads(body)
        ok = d.get('pages') == 3 and isinstance(d.get('text'), str)
        # Only require non-empty text if reportlab fixtures (text-bearing)
        if kind_a == 'reportlab':
            ok = ok and d.get('chars', 0) > 10
            detail += f' chars={d.get("chars")} pages={d.get("pages")}'
        else:
            detail += f' chars={d.get("chars")} pages={d.get("pages")} (blank fixtures)'
    except Exception as e:
        ok = False; detail += f' json-error={e}'
log('POST /pdf/extract-text', ok, detail)

# ── PDF: to-images ───────────────────────────────────────────────────────
out = os.path.join(WORK, 'imgs.zip')
code, _ = curl_multipart('/pdf/to-images', [('FILE','file',pdf_a)], out_path=out)
ok = code == 200
detail = f'http={code}'
if ok:
    try:
        with zipfile.ZipFile(out) as zf:
            names = zf.namelist()
            ok = len(names) == 3 and all(n.endswith('.png') for n in names)
            # Verify first PNG actually decodes
            with zf.open(names[0]) as f:
                head = f.read(8)
                ok = ok and head.startswith(b'\x89PNG\r\n\x1a\n')
            detail += f' files={len(names)} first={names[0]}'
    except Exception as e:
        ok = False; detail += f' zip-error={e}'
log('POST /pdf/to-images (3 PNGs in ZIP)', ok, detail)

# ─────────────────────────────────────────────────────────────────────────
# Universal Converter
# ─────────────────────────────────────────────────────────────────────────
section('Convert: info')
code, body = curl_json('/convert/info', {'filename': 'photo.png'})
try:
    d = json.loads(body)
    ok = code == 200 and d['category'] == 'image' and 'jpg' in d['targets']
    log('convert/info png', ok, f'targets={d.get("targets")}')
except Exception as e:
    log('convert/info png', False, f'http={code} err={e}')

code, body = curl_json('/convert/info', {'filename': 'song.flac'})
try:
    d = json.loads(body)
    ok = code == 200 and d['category'] == 'audio' and 'mp3' in d['targets']
    log('convert/info flac', ok, f'targets={d.get("targets")}')
except Exception as e:
    log('convert/info flac', False, f'http={code} err={e}')

code, body = curl_json('/convert/info', {'filename': 'mystery.xyz'})
try:
    d = json.loads(body)
    ok = code == 200 and d['supported'] is False
    log('convert/info unknown', ok, f'supported={d.get("supported")}')
except Exception as e:
    log('convert/info unknown', False, f'http={code} err={e}')

# ── Image conversions ────────────────────────────────────────────────────
section('Convert: image')
def img_test(label, src, target, expect_magic):
    out = os.path.join(WORK, f'out_{target}.{target}')
    code, _ = curl_multipart('/convert',
        [('FILE','file',src),('F','target',target)], out_path=out)
    ok = code == 200 and os.path.exists(out) and os.path.getsize(out) > 0
    detail = f'http={code}'
    if ok:
        with open(out, 'rb') as f:
            head = f.read(16)
        ok = head.startswith(expect_magic)
        detail += f' size={os.path.getsize(out)}B magic={head[:4].hex()}'
    log(label, ok, detail)

img_test('PNG → JPG',  png,  'jpg',  b'\xff\xd8\xff')
img_test('PNG → WEBP', png,  'webp', b'RIFF')
img_test('PNG → GIF',  png,  'gif',  b'GIF8')
img_test('PNG → BMP',  png,  'bmp',  b'BM')
img_test('PNG → TIFF', png,  'tiff', b'II*\x00')  # little-endian TIFF
img_test('PNG → ICO',  png,  'ico',  b'\x00\x00\x01\x00')
img_test('JPG → PNG',  jpg,  'png',  b'\x89PNG\r\n\x1a\n')
img_test('PNG-RGBA → JPG (alpha flatten)', pnga, 'jpg', b'\xff\xd8\xff')

# Same source/target rejection
code, body = curl_multipart('/convert',
    [('FILE','file',png),('F','target','png')])
log('PNG → PNG (rejected)', code == 400, f'http={code}')

# Unsupported target for category
code, body = curl_multipart('/convert',
    [('FILE','file',png),('F','target','mp3')])
log('PNG → MP3 (rejected)', code == 400, f'http={code}')

# ── Audio conversions ────────────────────────────────────────────────────
section('Convert: audio')
def audio_test(label, src, target):
    out = os.path.join(WORK, f'out_{target}.{target}')
    code, _ = curl_multipart('/convert',
        [('FILE','file',src),('F','target',target)], out_path=out)
    ok = code == 200 and os.path.exists(out) and os.path.getsize(out) > 0
    detail = f'http={code}'
    if ok:
        # Re-probe with ffprobe to confirm it's a valid media file
        p = subprocess.run(
            ['ffprobe','-v','error','-show_entries','stream=codec_type,codec_name',
             '-of','json', out],
            capture_output=True,
        )
        try:
            info = json.loads(p.stdout.decode('utf-8','replace'))
            streams = info.get('streams', [])
            audio_streams = [s for s in streams if s.get('codec_type') == 'audio']
            ok = len(audio_streams) >= 1
            detail += f' size={os.path.getsize(out)}B codec={audio_streams[0].get("codec_name") if audio_streams else "?"}'
        except Exception as e:
            ok = False; detail += f' probe-error={e}'
    log(label, ok, detail)

audio_test('WAV → MP3',  wav, 'mp3')
audio_test('WAV → FLAC', wav, 'flac')
audio_test('WAV → OGG',  wav, 'ogg')
audio_test('WAV → AAC',  wav, 'aac')
audio_test('WAV → M4A',  wav, 'm4a')
audio_test('WAV → OPUS', wav, 'opus')

# ── Video conversions ────────────────────────────────────────────────────
section('Convert: video')
def video_test(label, src, target, expect_video=True):
    out = os.path.join(WORK, f'out_{target}.{target}')
    code, _ = curl_multipart('/convert',
        [('FILE','file',src),('F','target',target)], out_path=out)
    ok = code == 200 and os.path.exists(out) and os.path.getsize(out) > 0
    detail = f'http={code}'
    if ok:
        p = subprocess.run(
            ['ffprobe','-v','error','-show_entries','stream=codec_type,codec_name',
             '-of','json', out],
            capture_output=True,
        )
        try:
            info = json.loads(p.stdout.decode('utf-8','replace'))
            streams = info.get('streams', [])
            v = [s for s in streams if s.get('codec_type') == 'video']
            ok = len(v) >= 1 if expect_video else True
            detail += f' size={os.path.getsize(out)}B vcodec={v[0].get("codec_name") if v else "?"}'
        except Exception as e:
            ok = False; detail += f' probe-error={e}'
    log(label, ok, detail)

video_test('MP4 → WEBM', mp4, 'webm')
video_test('MP4 → MOV',  mp4, 'mov')
video_test('MP4 → AVI',  mp4, 'avi')
video_test('MP4 → MKV',  mp4, 'mkv')
video_test('MP4 → GIF',  mp4, 'gif')

# ── Text conversions ─────────────────────────────────────────────────────
section('Convert: text')
out = os.path.join(WORK, 'out.csv')
code, _ = curl_multipart('/convert',
    [('FILE','file',jsonp),('F','target','csv')], out_path=out)
ok = code == 200
if ok:
    with open(out, 'r') as f:
        txt = f.read()
    ok = 'name' in txt and 'Ada' in txt and 'Bo' in txt
    log('JSON → CSV', ok, f'http={code} content-ok={ok}')
else:
    log('JSON → CSV', False, f'http={code}')

out = os.path.join(WORK, 'out.json')
code, _ = curl_multipart('/convert',
    [('FILE','file',csvp),('F','target','json')], out_path=out)
ok = code == 200
if ok:
    with open(out, 'r') as f:
        txt = f.read()
    try:
        d = json.loads(txt)
        ok = isinstance(d, list) and len(d) == 2 and d[0]['name'] == 'Ada'
        log('CSV → JSON', ok, f'http={code} rows={len(d)}')
    except Exception as e:
        log('CSV → JSON', False, f'http={code} parse-error={e}')
else:
    log('CSV → JSON', False, f'http={code}')

# Bad JSON shape (object, not array)
bad = os.path.join(WORK, 'bad.json')
with open(bad, 'w') as f: f.write('{"a":1}')
code, body = curl_multipart('/convert',
    [('FILE','file',bad),('F','target','csv')])
log('JSON object → CSV (rejected)', code == 400, f'http={code}')

# ── Cleanup + summary ────────────────────────────────────────────────────
shutil.rmtree(WORK, ignore_errors=True)

passes = sum(1 for r in results if r[1])
fails  = len(results) - passes
print(f'\n{"━"*60}')
print(f'  {passes} passed, {fails} failed, {len(results)} total')
print(f'{"━"*60}')
sys.exit(0 if fails == 0 else 1)
'''


def main() -> int:
    creds = load_creds()
    print(f'Connecting to {creds["HOST"]}…', flush=True)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=creds['HOST'],
        username=creds['USER'],
        password=creds['PASS'],
        timeout=30,
    )
    print('Connected.\n', flush=True)

    sftp = client.open_sftp()
    remote_path = '/tmp/_tools_pipeline_test.py'
    with sftp.open(remote_path, 'w') as f:
        f.write(REMOTE)
    sftp.close()

    # Make sure reportlab is available so we get text-bearing PDF fixtures.
    # If it's not, the remote script falls back to blank pages and the
    # extract-text test still passes (it tolerates 0 chars in that case).
    print('Ensuring reportlab is available for text-bearing PDF fixtures…', flush=True)
    _, out, _ = client.exec_command(
        'python3 -c "import reportlab" 2>/dev/null && echo OK || '
        'pip3 install --break-system-packages -q reportlab && echo INSTALLED'
    )
    print(f'  reportlab: {out.read().decode().strip()}', flush=True)

    print('\nRunning tests on the server…', flush=True)
    print('━' * 60, flush=True)
    transport = client.get_transport()
    chan = transport.open_session()
    chan.exec_command(f'python3 {remote_path}')

    # Stream output line by line
    while True:
        if chan.recv_ready():
            data = chan.recv(4096).decode('utf-8', errors='replace')
            sys.stdout.write(data)
            sys.stdout.flush()
        if chan.exit_status_ready() and not chan.recv_ready():
            break

    rc = chan.recv_exit_status()
    # Drain anything still buffered
    while chan.recv_ready():
        sys.stdout.write(chan.recv(4096).decode('utf-8', errors='replace'))
    sys.stdout.flush()

    client.exec_command(f'rm -f {remote_path}')
    client.close()
    return rc


if __name__ == '__main__':
    sys.exit(main())
