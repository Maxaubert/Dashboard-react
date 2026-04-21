"""Download Canvas files for all active courses to a local folder.

Strategy per course:
  1) Try /courses/{id}/files — direct file listing (fast, preserves folders).
  2) If that is 403/empty, fall back to module items + assignment attachments.

Reruns are safe: existing files are skipped unless size differs.
"""
from __future__ import annotations
import json, os, re, sys, time, urllib.request, urllib.parse, urllib.error
from pathlib import Path

TOKEN = "10900~TzzZUuuKY6BYkXCXfN6L6vvwyPQDLmGJWmLcTKDQNNLcVW3wm9cPGuvn4Z8uyTRV"
BASE = "https://hiof.instructure.com/api/v1"
DEST = Path(r"C:\Users\Admin\Documents\School\CanvasFiles")
HDR = {"Authorization": f"Bearer {TOKEN}"}

INVALID_FS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')

def safe(name: str) -> str:
    name = INVALID_FS.sub("_", (name or "").strip())
    return name[:180] or "untitled"

def _req(url: str):
    return urllib.request.Request(url, headers=HDR)

def api_get(url: str):
    with urllib.request.urlopen(_req(url), timeout=60) as r:
        return json.loads(r.read()), r.headers.get("Link", "")

def api_all(url: str):
    out = []
    while url:
        data, link = api_get(url)
        if isinstance(data, list):
            out.extend(data)
        else:
            out.append(data); break
        nxt = None
        for part in link.split(","):
            if 'rel="next"' in part:
                nxt = part.split(";")[0].strip().lstrip("<").rstrip(">")
        url = nxt
    return out

def download(url: str, dest: Path, expected_size: int | None = None) -> str:
    if dest.exists() and expected_size is not None and dest.stat().st_size == expected_size:
        return "skip"
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    req = _req(url) if url.startswith(BASE) else urllib.request.Request(url, headers=HDR)
    with urllib.request.urlopen(req, timeout=120) as r, open(tmp, "wb") as f:
        while True:
            chunk = r.read(1 << 15)
            if not chunk: break
            f.write(chunk)
    tmp.replace(dest)
    return "ok"

def build_folder_map(course_id: int) -> dict[int, Path]:
    """Map folder_id -> relative path inside the course dir."""
    folders = api_all(f"{BASE}/courses/{course_id}/folders?per_page=100")
    by_id = {f["id"]: f for f in folders}
    # 'full_name' looks like 'course files/sub/sub2'. Strip the first segment.
    m = {}
    for fid, f in by_id.items():
        full = f.get("full_name") or ""
        parts = [safe(p) for p in full.split("/")[1:]]  # drop "course files"
        m[fid] = Path(*parts) if parts else Path(".")
    return m

def download_course_files(course_id: int, course_dir: Path) -> tuple[int, int, int]:
    """Returns (downloaded, skipped, failed)."""
    try:
        files = api_all(f"{BASE}/courses/{course_id}/files?per_page=100")
    except urllib.error.HTTPError as e:
        if e.code in (401, 403, 404):
            return (-1, -1, -1)  # signal: fall back
        raise
    if not files:
        return (-1, -1, -1)
    folder_map = build_folder_map(course_id)
    ok = skip = fail = 0
    for f in files:
        rel = folder_map.get(f.get("folder_id"), Path("."))
        display = f.get("display_name") or f.get("filename") or "file"
        dest = course_dir / rel / safe(display)
        url = f.get("url")
        if not url:
            fail += 1; continue
        try:
            status = download(url, dest, f.get("size"))
            if status == "ok":
                ok += 1
                print(f"    + {rel / safe(display)}")
            else:
                skip += 1
        except Exception as e:
            fail += 1
            print(f"    ! {display}: {e}")
    return (ok, skip, fail)

def download_course_fallback(course_id: int, course_dir: Path) -> tuple[int, int, int]:
    """For locked courses: pull module file items + assignment attachments."""
    ok = skip = fail = 0
    seen: set[int] = set()

    # Modules -> File items
    try:
        modules = api_all(f"{BASE}/courses/{course_id}/modules?include[]=items&per_page=100")
    except urllib.error.HTTPError:
        modules = []
    for m in modules:
        mod_name = safe(m.get("name") or f"module_{m.get('id')}")
        for it in m.get("items") or []:
            if it.get("type") != "File":
                continue
            content_id = it.get("content_id")
            if not content_id or content_id in seen: continue
            seen.add(content_id)
            try:
                info, _ = api_get(f"{BASE}/files/{content_id}")
            except urllib.error.HTTPError as e:
                print(f"    ! file {content_id}: HTTP {e.code}"); fail += 1; continue
            display = info.get("display_name") or info.get("filename") or f"file_{content_id}"
            dest = course_dir / "Moduler" / mod_name / safe(display)
            url = info.get("url")
            if not url: fail += 1; continue
            try:
                status = download(url, dest, info.get("size"))
                if status == "ok":
                    ok += 1; print(f"    + Moduler/{mod_name}/{safe(display)}")
                else:
                    skip += 1
            except Exception as e:
                fail += 1; print(f"    ! {display}: {e}")

    # Assignment attachments
    try:
        assigns = api_all(f"{BASE}/courses/{course_id}/assignments?per_page=100")
    except urllib.error.HTTPError:
        assigns = []
    for a in assigns:
        # `description` may have embedded /files/{id} links; parse them.
        desc = a.get("description") or ""
        a_title = safe(a.get("name") or f"assignment_{a.get('id')}")
        for match in re.finditer(r"/files/(\d+)", desc):
            fid = int(match.group(1))
            if fid in seen: continue
            seen.add(fid)
            try:
                info, _ = api_get(f"{BASE}/files/{fid}")
            except urllib.error.HTTPError as e:
                print(f"    ! file {fid}: HTTP {e.code}"); fail += 1; continue
            display = info.get("display_name") or info.get("filename") or f"file_{fid}"
            dest = course_dir / "Innleveringer" / a_title / safe(display)
            url = info.get("url")
            if not url: fail += 1; continue
            try:
                status = download(url, dest, info.get("size"))
                if status == "ok":
                    ok += 1; print(f"    + Innleveringer/{a_title}/{safe(display)}")
                else:
                    skip += 1
            except Exception as e:
                fail += 1; print(f"    ! {display}: {e}")
    return (ok, skip, fail)

def main() -> int:
    DEST.mkdir(parents=True, exist_ok=True)
    print(f"Destination: {DEST}")
    courses = api_all(f"{BASE}/courses?enrollment_state=active&per_page=100")
    print(f"Active courses: {len(courses)}\n")

    grand_ok = grand_skip = grand_fail = 0
    for c in courses:
        cid = c.get("id")
        name = c.get("name") or f"course_{cid}"
        course_dir = DEST / safe(name)
        print(f"== [{cid}] {name}")

        ok, skip, fail = download_course_files(cid, course_dir)
        if ok == -1:
            print("   (files API locked — falling back to modules + assignment attachments)")
            ok, skip, fail = download_course_fallback(cid, course_dir)
        print(f"   => downloaded={ok}  skipped={skip}  failed={fail}")
        grand_ok += max(ok, 0); grand_skip += max(skip, 0); grand_fail += max(fail, 0)
        print()

    print("-" * 50)
    print(f"TOTAL  downloaded={grand_ok}  skipped={grand_skip}  failed={grand_fail}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
