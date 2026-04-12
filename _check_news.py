import io, sys, paramiko
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
creds = {}
with open('dashboard.txt', encoding='utf-8') as f:
    for line in f:
        if '=' in line:
            k, v = line.strip().split('=', 1)
            creds[k.strip()] = v.strip()
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(creds['HOST'], username=creds['USER'], password=creds['PASS'], timeout=15)
for src in ('nrk', 'aftenposten'):
    cmd = "curl -s 'http://127.0.0.1:3001/api/news?source=" + src + "&count=3'"
    _, out, _ = c.exec_command(cmd)
    raw = out.read().decode('utf-8', 'replace')
    print(f'=== {src} ===')
    import json
    try:
        items = json.loads(raw)
        for it in items[:3]:
            t = (it.get('title') or '')[:60]
            img = (it.get('img') or '')[:80]
            print(f'  - {t}')
            print(f'    img: {img or "(MISSING)"}')
    except Exception as e:
        print(f'  parse error: {e}')
        print(f'  raw: {raw[:200]}')
    print()
c.close()
