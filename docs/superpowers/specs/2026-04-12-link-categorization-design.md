# Link Categorization — Design Spec

**Status:** Approved 2026-04-12
**Target repo:** `Documents/Claude/Github/dashboard-react` (canonical)
**Scope:** The `LinksLibrary` component — used both by `/links` (`LinksPage`) and `LinksLibraryPopup`

## Summary

Add per-link categorization to the external links library. Links are grouped into sections: a derived **Favorites** section (from the existing `favorite` flag), user-defined categories, and a catch-all **Other** section for uncategorized links. Categories, their order, and rename/delete are managed through the existing edit modal and a right-click context menu on section headers. The home favorites carousel is unaffected.

## Goals

1. Let the user organize links into named sections on both library views (page + popup).
2. Preserve the existing "favorited link pinned to the top" UX via a derived Favorites section, without making Favorites a real category.
3. Support creating categories inline while editing a link (no separate onboarding flow).
4. Support renaming, deleting, and reordering categories with no data loss.
5. Support recategorizing a link via drag-and-drop between sections.
6. Keep the backend contract minimal — ideally a single write to the existing `/api/links` payload.

## Non-Goals

- **Home favorites carousel:** unchanged. Categorization is not exposed on `index.html`-equivalent widgets.
- **Multiple categories per link:** exactly one category per link. No tagging.
- **Per-category icons or colors:** not in this phase. Add later if needed.
- **Touch / mobile long-press for the context menu:** desktop-first. A long-press fallback can be added later without changing the data model.
- **Category descriptions or metadata beyond name + order:** no.

## Decisions (from brainstorming, all eight baked in)

1. **Favorites is a flag, not a category.** When `favorite === true`, the link renders in the Favorites section only. Unfavoriting returns it to its real category section with no data change. The existing `favorite: boolean` field stays.
2. **Single category per link.** New optional field `category?: string` (category id) on `LinkItem`.
3. **Uncategorized → "Other" section at the bottom,** explicitly labeled, only shown when at least one uncategorized link exists.
4. **Section header:** title-case label + muted count badge (e.g. `Dev  2`). No horizontal divider; spacing does the separation.
5. **Category picker (edit modal):** radio list with link counts, one row per category, plus a `"+ Ny kategori…"` row that opens an inline text input to create one.
6. **Section drag:** always-visible left grip (`⋮⋮`) on every section header. Every section is draggable, including Favorites and Other. No pinning.
7. **Cross-section drag for links:** dragging a link from one section's grid and dropping it into another's updates the link's `category`. Within-section drag still reorders as today.
8. **Rename / delete:** right-click a section header for a context menu with "Rename…" and "Delete". Rename opens an inline text input on the header. Delete confirms (`"Delete 'Dev'? 2 links will move to Other."`) then orphans fall back to Other — no link is ever deleted this way.

## Data Model

### `LinkItem` (extended — additive only)

```ts
interface LinkItem {
  id: string;
  url: string;
  name: string;
  sub?: string;
  color?: string;
  iconType?: LinkIconType;
  iconValue?: string;
  favorite?: boolean;

  /** NEW — category id, or undefined for uncategorized (rendered in Other) */
  category?: string;

  createdAt?: number;
  updatedAt?: number;
}
```

### `Category` (new)

```ts
interface Category {
  /** stable id, e.g. `cat_<nanoid>` */
  id: string;
  /** display name */
  name: string;
  /** position among user categories (excludes Favorites/Other, which have their own positions) */
  order: number;
  createdAt?: number;
  updatedAt?: number;
}
```

### Section ordering: pseudo-categories

Favorites and Other are derived sections, but Q6 requires them to be draggable. To keep ordering simple, we represent them as **pseudo-categories** with reserved ids in the same `Category[]` list that holds user categories:

- `{ id: '__favorites', name: 'Favorites', order: N }`
- `{ id: '__other', name: 'Other', order: N }`

One single `order` field then governs every section, user or derived. Pseudo-category entries are created on first run with default positions (`__favorites` at 0, `__other` at last) and persist like any other category entry. They cannot be renamed or deleted via the UI (the right-click context menu is suppressed on them), but they can be reordered by drag like any other section. Their membership is still derived at render time from the flag/undefined predicates — the `Category` entry exists only to anchor their position.

This removes the need for a separate `SectionLayout` type.

## Rendering / Layout

### Grouping function (pure)

Given `(links, categories, sectionLayout)`, produce an ordered list of sections:

```ts
type SectionRender =
  | { kind: 'favorites'; links: LinkItem[] }
  | { kind: 'user'; category: Category; links: LinkItem[] }
  | { kind: 'other'; links: LinkItem[] };

function groupLinks(
  links: LinkItem[],
  categories: Category[]
): SectionRender[];
```

Rules:
- `favorites.links = links.filter(l => l.favorite === true)` — deduplicated (a link appears here **only**, not in its underlying category section)
- `user.<cat>.links = links.filter(l => !l.favorite && l.category === cat.id)` — only for user categories (ids not starting with `__`)
- `other.links = links.filter(l => !l.favorite && !l.category)` — derived from the `__other` pseudo-category entry
- Section order is the ascending order of `Category.order` across the full list (including the `__favorites` and `__other` pseudo-categories)
- A section is **not rendered** when it has zero links (pseudo-categories included — if nothing is favorited, Favorites is hidden; if no link is uncategorized, Other is hidden)

### Section header

Matches Q4 pick B: `<h3>{title} <span class="count">{n}</span></h3>`. No bottom border. A `⋮⋮` grip prefixes the label for drag. Right-click opens the context menu.

### Grid

Each section renders its own `SortableList` grid (same `.links-grid` CSS as today). Drag-and-drop is connected across sections so a link dragged out of one grid and dropped into another updates its `category`. Uses dnd-kit's multi-container pattern.

## Edit Modal — Category Picker

A new `<div class="modal-row">` added to `LinkEditModal`, between the existing **Color** and **Icon** rows:

```
Category
  ○ Favorites (3)     ← disabled row, caption "Use the ★ button"
  ○ Dev (8)
  ● Reference (3)
  ○ Media (1)
  ○ Other (2)
  + Ny kategori…
```

Implementation notes:
- Favorites is displayed as a read-only row showing the count. The `favorite` flag is toggled via the existing star button on the card; the modal row exists only as a visual anchor so the picker feels complete. Clicking it is a no-op with a small hint tooltip ("Bruk stjerneknappen på kortet").
- "Other" is the synthetic pseudo-category shown when `category` is undefined.
- "+ Ny kategori…" swaps the row into a text input with a Save/Cancel pair. Pressing Enter or clicking Save creates the category (with next available `order`) and selects it.

## Drag-and-Drop

Three drag scopes, all driven by dnd-kit:

1. **Section reorder:** draggable sortable over section *headers*. Owned by the root `LinksLibrary`. Mutates `Category.order` values (pseudo-categories included — `__favorites` and `__other` reorder the same way as user entries).
2. **Link reorder within a section:** existing `SortableList` behavior per grid.
3. **Link cross-section drag:** dragged link's drop target is another section's grid. On drop:
   - If dropped into **Favorites**: no-op unless the link wasn't already favorited — set `favorite = true`. (Match UX: dragging into Favorites acts like clicking the star.)
   - If dropped into **Other**: clear `category` (set to undefined).
   - If dropped into **a user category**: set `category = target.id`.
   - In all cases, the link is also positioned according to its drop index within the target grid.

## Category Management

Creation: via the edit modal's picker (described above).

Rename / delete: right-click on a section header opens a small context menu:

- **Rename…** — swaps the header text into an inline input. Enter commits, Esc cancels. Empty names reject with a toast.
- **Delete** — shows a confirmation:
  - Empty section: `"Delete 'Dev'?"`
  - Non-empty: `"Delete 'Dev'? 2 lenker flyttes til Other."`
  - On confirm: remove the `Category` entry and unset `category` on any `LinkItem` referencing it. Links are not deleted.

Favorites and Other sections do **not** show this context menu — they are derived and cannot be renamed or deleted.

## Persistence

The links endpoint is extended to a versioned envelope. One round-trip, atomic save, no new API.

The server's `/api/links` starts accepting and returning:

```json
{
  "version": 2,
  "links": [ ...LinkItem[] ],
  "categories": [ ...Category[] ]
}
```

- **Read path:** server inspects the stored JSON. If the top-level is an array, treat as legacy v1 (`{ links: <array>, categories: [] }`). If it's an object with `version: 2`, return as-is.
- **Write path:** server always writes the v2 envelope.
- **Frontend:** `useLinks` and a new `useCategories` consume the enveloped shape. Both mutate the same payload — saves are one POST that replaces the whole envelope.

Backend change is localized to the links handler in `api.py`, ~20 lines of Python.

## Migration

- On first load after the feature ships:
  - `categories = []` (nothing yet)
  - All existing links have `category === undefined` → they render in **Other**
  - `favorite === true` links still render in **Favorites** (derived)
- The user categorizes at their own pace by editing links or dragging them into new categories.
- No destructive migration. No "initial setup wizard". Today's flat-grid behavior is the exact first-launch state.

## Testing

- **Unit:** `groupLinks(links, categories)` — pure function, cover:
  - Empty / single / many user categories
  - Favorites with mixed categorized/uncategorized links
  - Pseudo-category positioning (Favorites/Other drag-reordered to arbitrary positions)
  - Cross-section drop side-effects (category change, favorite toggle, uncategorize)
- **Integration (React Testing Library):** edit-modal create-category flow, rename flow, delete with orphan fallback.
- **Manual:** drag-across-sections on `/links` and inside `LinksLibraryPopup` (both rendering `<LinksLibrary />`).

## Implementation Touchpoints (non-binding, plan will decompose)

- `src/api/types.ts` — add `category?: string` to `LinkItem`; add `Category` type
- `src/api/links.ts` — update request/response shape to the v2 envelope
- `src/hooks/useLinks.ts` — return `{ links, categories }`; add `useCategories` helpers for create/rename/delete/reorder
- `src/pages/LinksPage.tsx` — `LinksLibrary` body: section loop instead of flat grid; new drag contexts; category picker row in `LinkEditModal`
- New: `src/components/links/SectionHeader.tsx` — header with grip, count, inline rename, right-click menu
- New: `src/components/links/CategoryPickerRow.tsx` — radio list + create
- New: `src/lib/groupLinks.ts` — pure grouping helper
- Backend: `api.py` links handler — accept v2 envelope, read back-compat for v1

## Open Questions (to decide during writing-plans)

- **Category id generation** — `crypto.randomUUID()` (built-in, preferred if TypeScript lib target supports it) vs `nanoid` dependency. Doesn't affect the spec either way.
- **Favorites row in the edit modal picker** — shown as a disabled row with a tooltip ("Bruk stjerneknappen på kortet"), or omitted entirely. Pure polish choice.
