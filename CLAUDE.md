# Dashboard — Project context for Claude Code

Personal single-user dashboard. React + TypeScript + Vite frontend, Python stdlib HTTP server, deployed to one Hetzner VPS at `37.27.210.14`.

**IMPORTANT: this repo is public at `github.com/Maxaubert/Dashboard-react`. Never commit secrets. Server-side API keys load from `/etc/dashboard.env` via systemd `EnvironmentFile=` (see Server conventions).**

## Stack

- **Frontend**: React 18, TypeScript ~5.6, Vite 5, react-query, dnd-kit, Tailwind 4, Radix UI, react-router 6, framer-motion, lucide-react.
- **Server**: Python 3 stdlib `ThreadingHTTPServer` in `server/api.py` (port 3001), plus Flask sidecars `server/notes_api.py` (5001) and `server/tools_api.py` (5002). nginx proxies them under `/api/*`.
- **Deploy**: paramiko/SFTP to Ubuntu, nginx + systemd. Service unit lives at `server/todo-api.service` (tracked).
- **UI language**: Norwegian (`nb-NO`). Don't translate user-facing strings to English.

## Path alias

`@/*` resolves to `src/*` (`tsconfig.app.json`). Use it for cross-area imports; relative paths for siblings inside the same folder.

## File organization (the established split)

- `src/pages/*.tsx` — **thin** page shells: state, mutations, top-level layout. Target: under 200 lines.
- `src/components/<area>/*.tsx` — per-page focused components (`todo/`, `links/`, `home/`, `widgets/`, `timer/`, `launcher/`, etc.).
- `src/lib/<area>.ts` — pure helpers + constants, **no React imports**.
- `src/hooks/*.ts` — react-query wrappers and cross-cutting hooks.
- `src/api/*.ts` — typed API clients (each resource gets its own file).
- `src/data/*.ts` — static config (icons, holidays, sports data).
- `server/` — Python services, nginx conf, systemd unit.
- `plans_md/` — multi-step plan/audit documents (gitignored except `TEMPLATE.md`).

When a page passes ~400 lines, split it the way `TodoPage`, `LinksPage`, `HomePage` were split: keep the page as an orchestrator, move JSX subcomponents to `components/<area>/`, pure helpers to `lib/<area>.ts`.

## Critical commands

| Task | Command |
|---|---|
| Typecheck | `npm run typecheck` |
| Tests | `npm test` (vitest) |
| Dev server | `npm run dev` (picks first free port from 5173) |
| Build | `npm run build` (runs `tsc -b && vite build`) |
| Deploy `server/api.py` | `python _deploy_api.py` (SFTP, restarts `todo-api`, smoke-tests endpoints) |
| Deploy frontend | `python _deploy_frontend.py` (uploads `dist/*` + `server/nginx.conf`, reloads nginx) |

**YOU MUST** run `npm run typecheck` before committing TS changes. **YOU MUST** run `npm test` before pushing.

## Server-side conventions

- **Secrets**: load via `_require_env('NAME')` at module top. Values live in `/etc/dashboard.env` on the server (mode 600, root). **Never hardcode keys in source — the repo is public.**
- **JSON data writes** in POST handlers use the atomic-write pattern: `tempfile.mkstemp(dir=os.path.dirname(file_path))` → write → `f.flush()` → `os.fsync(f.fileno())` → `os.replace(tmp, file_path)`. A crash mid-write must not truncate user data. Follow the pattern in `server/api.py:do_POST`.
- **Report appends** (`_append_report`) hold `fcntl.flock(fd, LOCK_EX)` across the entire read-check-seed-append. Two concurrent POSTs must not interleave their markdown or race the header-create.
- **Threading**: top-level uses `ThreadingHTTPServer` with `daemon_threads = True`. The single-threaded `HTTPServer` wedged in production once after `ConnectionResetError`s. Don't revert.

Server-side data files live in `/opt/dashboard/www/`: `todos.json`, `plan.json`, `links.json`, `home.json`, plus `*_cache.json`. Reports markdown lives one level up at `/opt/dashboard/reports/`.

## Frontend conventions

- **Multi-container DnD**: `useMultiContainerDnd` in `src/hooks/`. Used by `TodoListDnd` and `ColumnsDnd`. Pass `containers`, `containerIds`, `itemId`, `onCommit`, and optionally `transformOnMove` for cross-container item mutations.
- **Single-container DnD** (reorder only): just use `arrayMove` inline. See `HomePage.tsx` and `WidgetsSection.tsx`.
- **LinksLibrary** keeps its own DnD implementation. Section-vs-link drag duality, custom `pointerOrCorners` collision, `MeasuringStrategy.Always`, sensor distance 4, and click-suppression on drop don't fit the shared hook.
- **DnD testing**: dnd-kit's `PointerSensor` ignores synthetic JS events. Playwright's `evaluate`-dispatched `PointerEvent`s won't trigger drag. Manual user verification only for any DnD change.
- **State**: react-query is the source of truth for server data. `useLocalStorage` is for view preferences only (e.g. todo Liste/Kolonner choice).
- **Cross-page widgets**: pinning a todo (`togglePin`) calls `addWidget('todo', id)`; the widget renders in `WidgetsSection` on `/`. Unpin removes it.

## UI primitives (the design system that isn't)

`src/components/ui/` holds only `Modal` (focus trap, escape, backdrop) and `Toast` (app-wide notifications). Pages use raw `<button>` / `<input>` JSX. The old `Button/Card/Input/...` primitives were deleted because nothing imported them. **If you find yourself adding back a UI primitive, first check whether the pages would actually use it — otherwise add inline styles like the rest.**

## Git workflow

- **Branches**: `feat/<name>`, `refactor/<name>`, `fix/<name>`, `chore/<name>`.
- **Commits**: imperative subject. Body explains *why*, not *what*. End every body with:
  ```
  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```
- **PRs**: title under 70 chars. Body sections: `## Summary` (3-5 bullets) and `## Test plan` (checklist). Flag anything that needs manual user verification (e.g. drag UX).
- **No em-dashes** anywhere — code, commits, PRs, chat. Global user preference.
- **No emojis** in code or commits unless explicitly requested.

## Common gotchas

- Repo URL is `Maxaubert/Dashboard-react` (capital D). The old lowercase form redirects; the "This repository moved" line on push is harmless.
- `dashboard.txt` (gitignored) contains SSH password + host. The `_deploy_*.py` scripts read it via `_creds_path()`.
- The Claude Code auto-mode classifier blocks unfamiliar destructive actions (SSH-driven service restarts, MCP config edits). When blocked, surface the action to the user for explicit text approval — don't silently retry.
- Python output buffering: when running `_deploy_*.py` via the Bash tool, redirect to a file (`python -u script.py > _out.txt 2>&1; cat _out.txt`) — direct stdout sometimes shows empty.
- Vite dev server hops ports (`5173 → 5174 → ...`) if any are taken. Read the actual port from `_dev.log` before navigating.

## Where the bones are buried

- **Audit & plan docs**: `plans_md/` (gitignored). New plans follow `plans_md/TEMPLATE.md`.
- **The 2026-05-19 audit**: `plans_md/2026-05-19-codebase-audit.md` documents the Stage 1-6 cleanup with commit SHAs. Worth reading before any structural change.
- **One-shot migration scripts**: `_setup_env_secrets.py` (gitignored) ran once to move keys to `/etc/dashboard.env`. Re-running fails on purpose (the regex finds no keys in current `api.py`).
