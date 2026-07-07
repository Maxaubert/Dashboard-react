# Transparent (Nebula) glass mode — design

**Date:** 2026-07-07
**Status:** Approved design, pre-plan
**Author:** Max + Claude (brainstorming pipeline)

## Goal

Add a toggleable "transparent mode" to the dashboard so that, when viewed in the
Zen browser with the Nebula theme (Mica backdrop), the dashboard surfaces read as
frosted glass and the blurred desktop shows through. Off by default; the normal
solid dark app is unchanged when the toggle is off.

## Context (current architecture)

The app is effectively a **dark** app assembled from layered overrides:

- **Base theme** (`src/styles/globals.css`, `@theme`): light "Papir HUD" tokens,
  mostly overridden in practice.
- **Home page**: dark "bento" layout. `HomeBento.tsx` sets `body.bento-active`;
  styling in `src/styles/bento.css`. Canvas `#0c0c0d`, cards `#151517`, 22px
  radius, hairline borders `rgba(255,255,255,0.08)`.
- **Plan / Todo / Gaming / Links**: open as full-page overlays
  (`.page-overlay-panel`), re-darkened by `src/styles/overlay-dark.css`.
- **Modals**: darkened via `body.bento-active .lm-content` in `overlay-dark.css`.
- **Body-class precedent**: `bento-active`, `route-no-grid` are already toggled on
  `document.body`. `useLocalStorage` already backs view preferences.

A dark base is ideal for a Nebula glass mode: dark translucent panels over a
Mica-blurred desktop stay readable with the existing light ink.

## Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| Scope | **Whole app** — home bento + overlay pages + modals, one cohesive glass |
| Toggle location | **Settings modal** (`SettingsModal.tsx`), reusing the existing `settings-toggle` switch |
| Persistence | **localStorage** via `useLocalStorage` (key `dashboard:glass-mode`), no backend |
| Default | **Off** (only meaningful inside Zen + Mica) |
| Glass intensity | **Heavy** — surface `rgba(17,17,20,0.40)`, `backdrop-filter: blur(30px) saturate(150%)` |
| Readability floor | **None** (pure glass, per explicit choice) |

## Approach

A single body class **`glass-mode`** gates all glass styling, mirroring the
existing `bento-active` / `route-no-grid` pattern. All glass CSS lives in one new
file **`src/styles/glass.css`**, scoped under `body.glass-mode …`, so:

- It never affects the normal look (feature is one class away from off).
- It uses the same "scoped override wins via specificity" convention documented in
  `overlay-dark.css` (doubled class / descendant pairs beat single-class
  `!important` where needed).
- No base theme tokens change.

### Surfaces overridden under `body.glass-mode`

1. **Canvas** — the bento/app background goes `transparent` so Mica shows through.
2. **Cards** — `.bento-card`, `.lcard`, `.ncard`, `.gtile`, weather `.viz`,
   `.prompt-launcher-card`: `background: rgba(17,17,20,0.40)` +
   `backdrop-filter: blur(30px) saturate(150%)`.
3. **Overlay pages + modals** — `.page-overlay-panel`, `.lm-content`: same glass
   treatment so Plan/Todo/Gaming/Links and dialogs match the home page.

### Explicitly unchanged

- **Image tiles**: wishlist covers (`.gtile img`) and news thumbnails
  (`.ncard img`) stay opaque; only their container surfaces / gradient overlays
  go glass.
- **Weather scene**: `.viz` per-condition gradients (sunny/rain/etc.) are an
  intentional "display" and stay; the outer `.bento-card` wrapper goes
  transparent so the scene floats. Verify it doesn't look odd; if it does, reduce
  the scene's alpha (fallback, not default).
- **Grid / sunbeam**: already disabled under `bento-active`; no change.
- **Accent-colored text and light ink**: untouched.

## Components / data flow

- **New hook** `src/hooks/useGlassMode.ts`: thin wrapper over `useLocalStorage`
  (`dashboard:glass-mode`, boolean, default `false`). Returns `[enabled, setEnabled]`
  and, via effect, toggles `document.body.classList.toggle('glass-mode', enabled)`.
- **Wiring point**: applied app-wide in `AppShell` so every route is covered, not
  just home.
- **UI**: one new row in `SettingsModal` reusing the `settings-toggle` switch.
  Norwegian label, e.g. **"Gjennomsiktig modus (Nebula)"** + short hint line.
- **No Supabase migration, no serverless, no auth, no DnD touched.**

Loop: `SettingsModal` reads/writes the hook → hook writes localStorage + toggles
the body class → `glass.css` rules activate.

## Risks / open checks

- **Webpage vs Mica (the real risk)**: because the dashboard is a normal webpage,
  a transparent page background may not reveal the desktop Mica unless the Vercel
  URL is allowed for transparency in **Zen Internet** (per-site browser toggle).
  **First implementation step**: verify end-to-end in Zen that
  `background: transparent` actually reveals Mica. If it needs the Zen Internet
  whitelist, document it as a browser-side setup step (not code).
- **Non-Zen degradation**: elsewhere `backdrop-filter` still frosts, but with no
  desktop behind it reads as darker translucent cards over the normal canvas.
  Degrades gracefully, never breaks.

## Testing / verification

- `npm run typecheck` — baseline gate, must pass.
- Vitest unit test for `useGlassMode` (localStorage read / write / default).
- Manual visual verification in Zen: toggle on → home, an overlay page, a modal,
  and the weather card all read as glass and Mica shows through; toggle off →
  identical to current. Driven via the run/verify flow with screenshots.

## Out of scope

- Syncing the preference across devices (Supabase).
- A readability floor / adaptive contrast (declined; can be added later as a
  scoped `body.glass-mode` addition if bright wallpapers become a problem).
- Any change to the light base theme or non-glass visuals.
