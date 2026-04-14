# Alarm Feature Design

**Status:** Design
**Date:** 2026-04-14

## Goal

Add a one-shot wall-clock alarm as a fourth timer kind, surfaced in the `/tools/timer` pill bar (first position) and as a home-page widget. Mirrors the existing timer architecture (TimerContext, WidgetShell, TimerPopup) so it plugs into the widget/popup system without new infrastructure.

## Non-goals

- Recurring alarms (daily/weekly repeats).
- Multiple alarms active at once.
- Custom alarm sounds.
- Snooze.

## User experience

### Tool page (`/tools/timer`)

- New pill tab **ALARM** inserted at position 0 of the tab row (Alarm · Countdown · Stopwatch · Pomodoro).
- Body: big orange (`#f97316`) target time centered, small `RINGS AT` label above, `in Xh Ym` below the time.
- One pill-style button under the time. The label switches with state:
  - Unarmed: `SET ALARM`
  - Armed: `CANCEL`
  - Ringing: `STOP`
- Target time is click-to-edit: clicking the `HH:MM` digits swaps them for an input (same pattern as the pomodoro clock). Enter commits; Escape or blur discards.
- No timezone line shown on the body. Timezone is auto-detected from the browser (`Intl.DateTimeFormat().resolvedOptions().timeZone`) for display calculations only — the user still enters HH:MM.

### Home widget

- Standard `WidgetShell` (164×156, same as the other timer widgets).
- Header: `BellRing` icon from `lucide-react` + label `Alarm`.
- Body: target time centered, same orange color.
- Bottom: thin progress bar that drains right → left, filling from 100% at "set time" to 0% at "fire time."
- Right-click menu: Edit (opens `TimerEditDialog` color picker) and Remove.
- Click anywhere on the shell opens the popup.
- Three visible states:
  - **Armed** — full-brightness time, filled bar.
  - **Unarmed** — time and icon at reduced opacity (`rgba(255,255,255,0.22)` for the time, `0.4` for the header), empty bar. Widget is still clickable to open the popup and set the alarm.
  - **Ringing** — bright, orange border glow (`box-shadow: 0 0 12px rgba(249,115,22,0.3)`), border color bumped to `rgba(249,115,22,0.5)`, header label changes to `Ringing`.
- **Lifecycle:** the alarm widget is sticky once added. It does not use the 60s-after-zero auto-hide rule the other timers use. Once placed (via Add-widget dialog or auto-summoned when the alarm is armed from the tool page), it stays visible in its current state until the user right-click → Remove.
- **Auto-summon:** arming an alarm from the tool page auto-adds the alarm widget to home (same `persistent`-flag rule as countdown/stopwatch/pomodoro becoming active).

### Click-to-open popup

- Reuses the existing `TimerPopup` dialog pattern: 440×440 modal, backdrop blur.
- Layout mirrors the tool page body exactly, scaled up (larger time font, larger button).
- Same states/transitions as the tool page.

### Add-widget dialog

- Stage 2 (timer kind picker) gains a fourth tile, `Alarm`, inserted as the first tile.
- Same interaction as the other timer tiles: tap → brief color flash (orange) → widget added to home and this session's alarm becomes "persistent" (visible regardless of state).

### Empty / default time

- There is no `--:--` placeholder. When no alarm is set, the time shown is:
  1. The last alarm time the user set (persisted in `lastSetTime`), or
  2. `12:30` as a global fallback if nothing has ever been set.
- Both the tool page and the popup follow this rule.
- The `SET ALARM` button arms whatever time is currently shown. The user can edit the digits first via click-to-edit (same pattern as pomodoro). No separate "pick time" step.
- `CANCEL` (from armed) preserves the time. `lastSetTime` is updated whenever the user successfully arms an alarm, so a cancel-then-re-set returns to the same time.

### Ringing behavior

- When the alarm fires:
  - Chime is the existing `playAlarm` two-tone sequence (880→1175 Hz, the same one used for countdown end). It loops continuously until the user clicks `STOP`.
  - An auto-open rule surfaces the alarm so the user notices:
    - If the user is on the home page → popup auto-opens.
    - If the user is on `/tools/timer` but not on the Alarm tab → popup auto-opens.
    - If the user is on `/tools/timer` on the Alarm tab → nothing auto-opens; the tab already shows the Ringing state and the STOP button is visible.
    - If *any* popup is already open (e.g., the user is editing the countdown popup) → wait; do not auto-open. The widget/tab ringing state is visible behind; we don't fight the user.
- **Only `STOP` dismisses.** While the alarm is ringing, the popup is non-dismissable: pressing Esc, clicking the backdrop, and the dialog's close button are all blocked. The user must click `STOP`. This guarantees an intentional dismiss.
- Clicking `STOP` stops the chime and disarms the alarm (one-shot, does not re-fire).

### Past-time handling

- If the user sets a time earlier than the current time, the alarm fires *tomorrow* at that time.
- Internally the alarm stores an absolute epoch millisecond target, not just HH:MM, so DST transitions and clock changes after arming don't silently move the fire time.

## Data model

Extend `TimerContext`. New `AlarmTimer` kind alongside the three existing ones:

```ts
export interface AlarmTimer extends BaseTimer {
  kind: 'alarm';
  /** Wall-clock HH:MM the user entered (24h). */
  targetTime: string;
  /** Last saved HH:MM — this is what we show when unarmed. Initialized to '12:30'. */
  lastSetTime: string;
  /** Absolute epoch ms when this alarm should fire. null when unarmed. */
  fireAt: number | null;
  /** True between fireAt and STOP click. */
  ringing: boolean;
}
```

- `running` on the base type is reused to mean "armed and counting down" — true while `fireAt !== null && !ringing`.
- `startedAt`/`zeroedAt` reused as on the other kinds.
- No new localStorage key; piggyback on `home-timers-v3` (the existing timer store) by bumping to `home-timers-v4` and adding a load-time migration that inserts the alarm with defaults if absent.

## State machine

```
           click SET ALARM (or click widget in unarmed)
unarmed ─────────────────────────────────────────────────▶ armed
   ▲                                                        │
   │                                                        │ fireAt reached
   │   click STOP (disarms, saves lastSetTime)              ▼
   └──────────────────────────────────────────────────── ringing
   ▲                                                        │
   └──────────── click CANCEL (from armed) ─────────────────┘
                (moves back to unarmed)
```

## Ticker integration

- The existing 100ms ticker in `TimerProvider` already drives the countdown/pomodoro decrement. The alarm doesn't need a decrement; it only needs to detect `Date.now() >= fireAt` to transition to ringing.
- Zero-crossing detection already runs in the alarms effect. Add an alarm branch: when `prev.running && !t.ringing && Date.now() >= t.fireAt`, transition to ringing + start the looping chime.
- When `t.ringing` becomes true, start a looping chime (`setInterval` wrapper around `playAlarm`, interval ≈ 1.5s so beeps don't step on each other). Track the interval id on a ref; clear it when ringing → false.

## Auto-open popup logic

- Managed in `WidgetsSection` (home) and `TimerTool` (tools page) since those are the views that control popup state.
- Watch `ctx.getTimer('alarm').ringing`. When it flips false → true:
  - Home: if no other `TimerPopup` is open, set `popupKind = 'alarm'`.
  - Tools page: if current pill tab is not `alarm`, open the popup; else no-op.
- Do not auto-open on subsequent ticks while `ringing` is already true — only on the edge.

## Files

### New

- `src/components/widgets/timers/AlarmWidget.tsx` — home widget (parallels `CountdownWidget`).
- `src/components/timer/AlarmMode.tsx` — tool-page body for the Alarm pill (parallels `CountdownMode`).
- Add an `AlarmBody` component inside the existing `TimerPopup.tsx` file (parallels `CountdownBody`).

### Modified

- `src/context/TimerContext.tsx` — add `AlarmTimer` type, reducer cases, default, load-migration to v4, ticker/alarms effect branch, looping chime wiring.
- `src/hooks/useTimer.ts` — export a `startLoopingAlarm()` / `stopLoopingAlarm()` pair that wrap the existing `playBeepSequence`.
- `src/components/timer/TimerMode.tsx` (or wherever the pill tabs live) — insert Alarm as the first tab.
- `src/components/widgets/AddWidgetDialog.tsx` — insert Alarm as the first tile in stage 2, orange flash color.
- `src/components/widgets/WidgetsSection.tsx` — render `AlarmWidget` when `w.type === 'alarm'`, auto-open rule.
- `src/hooks/useWidgets.ts` — add `'alarm'` to the `WidgetType` union.

## Testing

- Unit tests on the reducer (`TimerContext.vitest.ts`):
  - Setting a future time → `fireAt` computed correctly, `running` true.
  - Setting a past time → `fireAt` is tomorrow at that wall-clock time.
  - Reducer `alarm/fire` transition: `running` false, `ringing` true, `fireAt` nulled.
  - `alarm/stop`: clears ringing, saves `targetTime` into `lastSetTime`.
  - Cancel from armed: back to unarmed, preserves `lastSetTime`.
- Manual verification for:
  - Looping chime really stops on STOP and doesn't leak an interval on navigation.
  - Auto-open rule doesn't re-fire the popup if already open.
  - Editing the clock digits mid-arm: should re-compute `fireAt`.

## Open questions / deferred

- **DST edge case**: if an alarm is armed at 22:00 for 03:00 the next day and a DST "spring forward" happens at 02:00, should it fire at 03:00 new wall-clock (same abs time) or at what would-have-been 03:00 in old time? Current design uses absolute epoch, so it fires at the new 03:00. Acceptable trade-off; calling this out for later if it becomes a pain point.
- **Tab-inactive reliability**: browsers throttle `setInterval` in background tabs, so the 100ms ticker may run at ~1s in a backgrounded tab. The alarm will still fire within a second or two of the target; if sub-second accuracy matters, we'd switch to a single `setTimeout(fireAt - Date.now())` scheduled on arm — but that breaks the tick architecture. Deferred until it actually bites.

## Risks

- localStorage migration v3 → v4: if any v3 timer state is loaded on a machine that never runs this new version, nothing breaks (load handles missing alarm). Risk is low.
- The looping chime on background tabs: if the user switches tabs, the chime stops reliably because audio contexts pause. Re-focusing the tab restarts the interval on the next tick. Acceptable.
