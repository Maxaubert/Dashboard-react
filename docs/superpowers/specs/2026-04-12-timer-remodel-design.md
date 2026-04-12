# Timer/Pomodoro Remodel Design Spec

## Overview

Full visual and structural remodel of the existing Timer tool (`/tools/timer`). Splits one 749-line file into 8 focused components, replaces the thin ring with a thick glowing ring, adds framer-motion animations throughout, and removes the +/- adjustment buttons in favor of click-to-edit.

The three modes (Countdown, Stopwatch, Pomodoro) stay on one page, switched via an animated pill toggle.

## Architecture

### File Structure

**Before:** 1 file, 749 lines (`src/pages/tools/ToolTimerPage.tsx`)

**After:**

```
src/pages/tools/
  ToolTimerPage.tsx                ~60 lines  — shell: pill toggle + mode routing

src/components/timer/
  PillToggle.tsx                   ~40 lines  — animated 3-option pill (framer-motion)
  TimerRing.tsx                    ~100 lines — SVG ring with glow, progress, segments
  TimerControls.tsx                ~50 lines  — circular play/pause/reset buttons
  CountdownMode.tsx                ~120 lines — countdown timer state + UI
  StopwatchMode.tsx                ~120 lines — stopwatch state + laps + UI
  PomodoroMode.tsx                 ~150 lines — pomodoro state + segmented ring + settings

src/hooks/
  useTimer.ts                      ~80 lines  — shared timing engine (perf.now delta)
```

### New Dependency

**framer-motion** — React animation library. Used for pill toggle springs, content transitions, ring progress, button interactions, lap list layout animations. This dependency will be shared across all dashboard enhancement items.

### Kept from Current Implementation

- `performance.now()` delta timing engine → extracted to `useTimer.ts`
- Web Audio API alarm (880Hz/1175Hz sine wave beeps)
- Browser notification system with permission request
- localStorage persistence for pomodoro settings (`tool-pomodoro-settings-v2`)
- Click-to-edit time input parsing (accepts "25", "1:30", "1:30:00")
- Stopwatch lap tracking with delta and total times

### Removed

- +5m / +1m / -1m / -5m adjustment buttons
- Tab-based mode switching (replaced with animated pill)
- Thin 2px progress ring (replaced with thick 8px glowing ring)

## Visual Design

### Ring Display

- **Thickness:** 8px stroke width (was ~2px)
- **Glow:** CSS `filter: drop-shadow(0 0 8px <color>)` with ~30% opacity of accent color
- **Track:** `rgba(255, 255, 255, 0.04)` background ring
- **Progress:** Accent-colored stroke with `stroke-linecap: round`
- **Size:** 400×400px desktop, 280×280px mobile (unchanged)
- **Center content:** Mode label (uppercase, small, accent color at 50% opacity) + large monospace time

### Color System

| Mode | Color | Hex |
|------|-------|-----|
| Countdown | Red | #ef4444 |
| Stopwatch | Cyan | #22d3ee |
| Pomodoro Focus | Mint green | #34d399 |
| Pomodoro Break | Cyan | #06b6d4 |

Colors apply to: ring stroke, ring glow, play button gradient, mode label text.

### Controls

- **Play/Pause:** 48px circular button with gradient background (`linear-gradient(135deg, <color>30%, <color>15%)`) and `box-shadow: 0 0 12px <color>` glow. Color matches current mode.
- **Reset:** 48px circular button with `rgba(255,255,255,0.04)` background and `rgba(255,255,255,0.08)` border.
- **Stopwatch Lap:** Same styling as Reset, labeled "Lap".

### Pill Toggle

- Container: dark background (#08080a), 1px border, 24px border-radius, 4px padding
- Three options: Timer | Stopwatch | Pomodoro
- Active state: colored background pill that slides via framer-motion `layout` animation. Pill color matches the selected mode's accent (red for Timer, cyan for Stopwatch, green for Pomodoro) — color transitions smoothly on switch.
- Active text: dark (#000) on colored background
- Inactive text: `rgba(255,255,255,0.4)`
- Spring config: `stiffness: 500, damping: 30`

## Animations (framer-motion)

| Element | Animation | Type |
|---------|-----------|------|
| Pill toggle background | Slides to active option | `layout` + spring (500/30) |
| Mode content | Slides left/right based on direction | `AnimatePresence` + translateX spring |
| Ring progress | stroke-dashoffset animates | `motion.circle` + tween (smooth, not spring) |
| Ring glow | Gentle pulse while running | Animated drop-shadow intensity |
| Play/Pause/Reset buttons | Scale down on press | `whileTap={{ scale: 0.9 }}` + spring |
| Time edit transition | Time fades/scales out, input in | Scale + opacity spring |
| Lap list entries | New laps push from top | `layout` animation |
| Phase transition (pomodoro) | Ring color morphs | Color tween over 0.5s |

## Mode-Specific Details

### Countdown Mode

- Ring shows remaining time as progress arc (full → empty)
- Click time to edit (only when paused/not started)
- Edit mode: accent-colored border highlight around input, "Enter to confirm · Esc to cancel"
- Accepts formats: "25" → 25:00, "1:30" → 1:30, "1:30:00" → 1h 30m
- Shows "FERDIG" label when countdown hits zero
- Plays alarm + browser notification on completion

### Stopwatch Mode

- Ring stays full (decorative, counts up)
- Displays elapsed time as MM:SS.cs (centiseconds in smaller text)
- Lap button appears alongside play/pause when running
- Lap list below controls:
  - Latest lap highlighted with accent border
  - Each row: lap number, delta time (+), total time
  - New laps animate in from top, pushing others down
  - Max visible height, scrollable

### Pomodoro Mode

- **Segmented ring:** Ring divided into N segments (one per session target, default 4). Small gaps between segments.
  - Completed segments: solid accent color
  - Current segment: partially filled (tracks focus/break progress)
  - Remaining segments: dim track color
- **Center label:** "Focus 3/4" or "Pause 3/4" showing phase + progress
- **Inline settings** below controls: three editable fields always visible
  - Focus (minutes), Break (minutes), Sessions (count)
  - Tap field to edit, same style as time edit
  - Persist to localStorage
- **Phase transitions:**
  - Focus → Break: ring color animates green → cyan, segment fills, alarm, notification
  - Break → Focus: color animates cyan → green, next segment starts
  - All done: full ring, "FERDIG" label, glow pulses once
  - Auto-advance between phases (no manual click needed)

## Click-to-Edit Interaction

1. User clicks the large time display
2. Time text fades/scales out (framer-motion)
3. Input field fades/scales in with accent-colored border
4. User types new time value
5. Enter confirms → input fades out, new time fades in
6. Escape cancels → reverts to previous time
7. Only available when timer is paused or not started

## Responsive Design

- Desktop: ring 400×400px, time font ~4.8rem
- Mobile (≤640px): ring 280×280px, time font ~3.2rem
- Controls and settings scale proportionally
- Pill toggle stays full-width on mobile

## CSS

Update existing `.tt-*` classes in `globals.css` (lines 1338-1697). Replace thin ring styles with thick glow styles. Remove `.tt-adjust-btn` classes. Add framer-motion doesn't need CSS — it's inline via motion components.

## Out of Scope

- No todo integration (enhancement list item #3)
- No daily stats or session history tracking
- No long break after Nth session (keep simple focus/break 2-phase)
- No home page widget (enhancement list item #6)
