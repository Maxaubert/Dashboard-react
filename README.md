# Dashboard (React)

React rewrite of the personal dashboard. Replaces the loose collection of
HTML files in the parent folder with a single, component-based SPA.

## Stack

- **Vite + React 18 + TypeScript** — fast dev, type-safe, builds to static files
- **Tailwind CSS v4** — design tokens defined in `src/styles/globals.css`
- **React Router v6** — client-side routing
- **TanStack Query** — data fetching, caching, optimistic mutations
- **Radix UI** — unstyled accessible primitives (Dialog, Tabs, Tooltip, Dropdown)
- **dnd-kit** — drag-and-drop for sortable lists
- **react-markdown** — for the notes page

## Layout

```
src/
  api/          API client + per-endpoint modules + shared types
  hooks/        TanStack Query wrappers (one per domain)
  components/
    layout/     AppShell, Sidebar, MobileDrawer, PageHeader
    ui/         Primitives: Button, Card, Modal, Input, Badge, Toast, ...
    patterns/   SortableList, HorizontalScroller, IconPicker, PdfViewer, ...
  pages/        One file per route
  styles/       globals.css with design tokens
  lib/          Utilities (cn, dates, ...)
```

## Running

```bash
npm install
npm run dev      # http://localhost:5173, /api/* proxies to 37.27.210.14:3001
npm run build    # → dist/, ready to deploy to /opt/dashboard/www/
npm run typecheck
```

## Backend

The backend (`api.py` and `server/notes_api.py` in the parent folder) is
**unchanged**. Every fetch in this app uses relative `/api/*` paths, which
nginx already proxies to the API server on `127.0.0.1:3001` in production.
In dev, Vite's proxy (see `vite.config.ts`) forwards them to the live host.

## Migration status

This is the React replacement for the legacy HTML dashboard. The old `.html`
files in the parent folder remain in place during the migration so production
stays up. Once every page is verified, they will be removed.

See `../PROJECT_OVERVIEW.txt` for the full picture of the legacy app.
