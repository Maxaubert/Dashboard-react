# Single-page dashboard: remove sidebar, pages as pop-out overlays

Date: 2026-06-19
Status: Approved design, pending spec review
Branch: `feat/single-page-dashboard` (off `feat/home-wishlist`)
Issue: #23 (builds on #22)

## Goal

Collapse the app to a single page. The sidebar, mobile drawer, widgets/pinning
system, and the Sport + Notes areas are removed. The four surviving areas
(Plan, Todo, Gaming, Links) each appear as a compact preview section on the
home page, each with a "Vis alle" that opens the full existing page in a
state-driven pop-out overlay. Home sections stay drag-reorderable.

## Decisions (locked)

- **Model**: preview section per area + "Vis alle" opens the full page in a pop-out.
- **Overlay mechanism**: pure overlay, state-driven, NO URL change. Per-area
  routes are removed; only `/`, `/login`, `/signup` remain.
- **Removed entirely**: Sport, Notes (Skole already gone), the widgets/pinning system.
- **Kept non-area sections**: prompt-launcher, weather (vaer), news (nyhetssaker).
- **Pages in overlays**: render the existing page components unchanged (with
  their current in-page headers).

## Removals

- `src/components/layout/Sidebar.tsx`, `src/components/layout/MobileDrawer.tsx`,
  `src/components/layout/navConfig.tsx`, and the unused icons in `navIcons.tsx`.
- Sidebar logic in `src/components/layout/AppShell.tsx` -> AppShell becomes a thin
  centered container (the resize/width logic and the `<Sidebar>`/`<MobileDrawer>`
  render go away).
- Widgets: `src/components/widgets/WidgetsSection.tsx`, the whole
  `src/components/widgets/` tree (incl. `todo/TodoWidget.tsx`),
  `src/hooks/useWidgets.ts`, the `'widgets'` section id, and the
  `togglePin`/`addWidget` pin-to-home path in `src/pages/TodoPage.tsx`
  (remove the pin button + its handler; todos keep all other behavior).
- `src/components/home/SectionKategorier.tsx` + the `'kategorier'` section id.
- `src/pages/SportPage.tsx`, `src/data/sportsData.ts` (+ any sport-only data).
- `src/pages/NotesPage.tsx`, `src/api/notes.ts`, `src/hooks/useNotes.ts`. The
  Supabase `notes` table is left in place (unused; no migration).
- Routes `/plan /todo /notes /sport /gaming /links` removed from `src/App.tsx`.
- Grep after each removal to ensure no dangling imports/usages remain.

## Pop-out overlay system

- `src/context/PageOverlayContext.tsx`: a provider + `usePageOverlay()` hook.
  State is `OverlayKey | null` where `OverlayKey = 'plan' | 'todo' | 'gaming' | 'links'`.
  Exposes `openOverlay(key)`, `closeOverlay()`, and the current `key`.
- `src/components/overlay/PageOverlay.tsx`: renders nothing when `key` is null;
  otherwise a large modal (reuse the existing `Modal` primitive in
  `src/components/ui/` for focus-trap/escape/backdrop) containing the page for
  `key`:
  - `plan` -> `<PlanPage />`, `todo` -> `<TodoPage />`, `gaming` -> `<GamingPage />`,
    `links` -> `<LinksPage />`.
  - A close button (and backdrop/escape) calls `closeOverlay()`.
- `PageOverlayProvider` wraps the guarded app in `App.tsx`; `<PageOverlay />` is
  rendered once at that level (above the home page).

## Preview sections (home)

Final `SECTION_IDS` order (drag-reorderable):
`['prompt-launcher', 'todo', 'dagens-plan', 'wishlist', 'ext-lenker', 'vaer', 'nyhetssaker']`.

- **Plan** -> existing `SectionDagensPlan`. Add a "Vis alle" affordance that calls
  `openOverlay('plan')`.
- **Gaming** -> existing `SectionWishlist`. Its header "Alle" link (currently a
  `<Link to="/gaming">`) becomes a button calling `openOverlay('gaming')`.
- **Links** -> existing `SectionEksterneLenker`. Its "Alle" link (`<Link to="/links">`)
  becomes a button calling `openOverlay('links')`.
- **Todo** -> NEW `src/components/home/SectionTodo.tsx`: a compact preview of the
  user's top open todos (uses the existing `useTodos` hook; show e.g. the first
  ~5 not-done todos, highest priority first), with a "Vis alle" calling
  `openOverlay('todo')`. Header matches the other sections (grip handle + title +
  "Vis alle").
- Register `'todo'` in `SortableHomeSection.tsx`; remove the `'widgets'` and
  `'kategorier'` render branches.

Any home `<Link to="/...">` that pointed at a removed route is converted to an
`openOverlay(...)` button (Gaming, Links, Plan); the launcher/weather/news
sections are untouched.

## Layout / chrome

- `AppShell` no longer renders the sidebar/drawer; it just centers the page
  content (`<div className="page">` max-width container as today).
- The logout button + display name (currently at the sidebar bottom, via
  `useCurrentUser`/`useLogout`) move into a small header on the home page
  (top-right of the existing `PageHeader` area), so the user can still see who
  they are and log out.

## Testing

- `npm run typecheck` + `npm test` + `npm run build` stay green; removals leave
  no dangling imports/routes (grep + build).
- A small unit test for `SectionTodo`'s preview selection (top-N open todos,
  priority order) if a pure helper is extracted; otherwise covered by build.
- Manual verification (overlay open/close per area, drag-reorder, escape/backdrop,
  logout from the new header). DnD remains manual-verify per project convention.

## Out of scope

- Visually adapting the full pages for the modal (kept as-is; trim later).
- Dropping the Supabase `notes` table (left unused).
- Any new customizability beyond the existing section drag-reorder.

## Rollout order (informs the plan)

1. PageOverlay context + component + wire into App (no behavior change yet; routes still exist).
2. Repoint the existing area sections' "Alle" links to `openOverlay`; add the Todo preview section; update `SECTION_IDS`/`SortableHomeSection`.
3. Move logout/display-name into the home header.
4. Remove the sidebar + mobile drawer + AppShell sidebar logic + navConfig.
5. Remove the widgets/pinning system (+ TodoPage pin).
6. Remove Sport + Notes (pages, data, hooks, api) + the per-area routes.
7. Final grep/build sweep + manual verification.
