# Home section visibility (modular dashboard) — design

Issue: #27
Date: 2026-06-20

## Goal

Let the user show or hide any of the home page's modular sections from a Settings
popup, so the dashboard becomes modular. A gear button in the top-right of the
home page opens a popup with one toggle per section. Hidden sections disappear
from the page and reappear (in their original position) when toggled back on.

## Scope

Exactly the 7 existing home sections, identified by their `SectionId`:

| id | label (nb-NO) |
|---|---|
| `prompt-launcher` | Hurtigsøk |
| `todo` | Gjøremål |
| `dagens-plan` | Dagens plan |
| `wishlist` | Ønskeliste |
| `ext-lenker` | Eksterne lenker |
| `vaer` | Vær |
| `nyhetssaker` | Nyheter |

Out of scope: toggling sub-items inside a section, toggling the overlay pages
(Plan/Todo/Gaming/Links), or any per-section configuration beyond show/hide.

## Data model

Add a `hidden` array to the home envelope, alongside the existing `sections`
order. It stores the ids of sections the user has hidden.

```ts
// src/api/types.ts
export interface HomeEnvelope {
  version: 1;
  sections: string[];
  hidden: string[];   // NEW — section ids the user has hidden
  widgets: HomeWidget[];
  habits: HomeHabit[];
}
```

- Persisted server-side in the existing `documents` row (`kind = 'home'`, JSONB).
  No SQL migration needed — the column is already JSONB.
- `normaliseHome` defaults `hidden` to `[]` when the backend payload omits it, so
  existing rows (which have no `hidden` key) load as "nothing hidden".
- `EMPTY_HOME` in `useHome.ts` gains `hidden: []`.
- Unknown ids in `hidden` are harmless: rendering filters by membership, so a
  stale id simply matches nothing.

## Section labels

Add a label map to `src/lib/home.ts`, next to `SECTION_IDS`:

```ts
export const SECTION_LABELS: Record<SectionId, string> = {
  'prompt-launcher': 'Hurtigsøk',
  'todo': 'Gjøremål',
  'dagens-plan': 'Dagens plan',
  'wishlist': 'Ønskeliste',
  'ext-lenker': 'Eksterne lenker',
  'vaer': 'Vær',
  'nyhetssaker': 'Nyheter',
};
```

## UI

### Settings button

A gear icon button (`Settings` from `lucide-react`) rendered in `.home-topbar`,
to the left of `HomeAccount` (so the top-right cluster reads: gear · name · Logg
ut). It opens the settings modal. `aria-label="Innstillinger"`, `title` likewise.

### Settings modal

Reuses the existing `Modal` primitive (`src/components/ui`, with focus trap +
escape + backdrop). New component `src/components/home/SettingsModal.tsx`.

- Title: "Innstillinger".
- Body: the 7 sections listed in current page order (i.e. iterate the resolved
  `order`, not raw `SECTION_IDS`, so the list mirrors the page). Each row shows
  the section label and a toggle switch on the right.
- A toggle reflects "visible" = `!hidden.includes(id)`. Flipping it off adds the
  id to `hidden`; flipping it on removes it. Writes go through `useMutateHome`
  (optimistic, instant; no save button — changes apply live behind the modal).
- The toggle is raw styled JSX (a `<button role="switch" aria-checked>`), not a
  new UI primitive, per the repo's "no design system" convention. New CSS class
  e.g. `.settings-row` + `.settings-toggle`.

### Modal close

Standard: backdrop click, escape, and an X (whatever `Modal` already provides).
No explicit Save/Cancel — toggles are immediate.

## Rendering logic (HomePage)

`HomePage` already computes `order: SectionId[]` (all known ids, validated). Add:

```ts
const hidden = home?.hidden ?? [];
const visible = order.filter((id) => !hidden.includes(id));
```

- The `SortableContext items` and the rendered list both use `visible`.
- Drag-reorder logic is UNCHANGED: `handleDragEnd` keeps operating on the full
  `order` via `order.indexOf(active.id)` / `indexOf(over.id)`. Because both the
  dragged and the drop-target sections are visible, `arrayMove` on the full
  `order` reorders them correctly while hidden ids keep their relative slots — so
  a re-shown section returns to where it was.
- The gear button + `SettingsModal` mount in the topbar regardless of visibility,
  so the user can always re-open settings.

### Empty state

If `visible.length === 0` (every section hidden), render a short hint where the
sections would be:

> "Alle seksjoner er skjult – åpne Innstillinger for å vise dem."

(class e.g. `.home-empty-hint`). The gear button remains available in the topbar.

## Files touched

- `src/api/types.ts` — add `hidden` to `HomeEnvelope`.
- `src/hooks/useHome.ts` — `EMPTY_HOME` + `normaliseHome` default `hidden: []`.
- `src/lib/home.ts` — add `SECTION_LABELS`.
- `src/pages/HomePage.tsx` — compute `visible`, render gear button + modal, empty hint.
- `src/components/home/SettingsModal.tsx` — NEW: the toggle list.
- `src/styles/globals.css` — gear button, settings rows, toggle switch, empty hint.

## Testing

- Unit (vitest): `normaliseHome` returns `hidden: []` for payloads with and
  without the key, and preserves a provided `hidden` array. This is the one piece
  of pure logic worth a test; the rest is wiring/UI.
- Manual: toggle each section off/on and confirm it disappears/reappears; confirm
  a hidden section returns to its prior order position; reload and confirm the
  state persisted (server round-trip); hide all → empty hint shows; reorder some
  sections then hide/show one and confirm order is preserved.
- `npm run typecheck` and `npm test` must pass before pushing.

## Non-goals / YAGNI

- No drag-to-reorder inside the settings list (order is still managed on the page).
- No per-device override; visibility is global to the user (server-stored).
- No animation on hide/show beyond whatever the section mount already does.
