# Dashboard Enhancement List

Prioritized list of upcoming enhancements for the dashboard-react project.

## 1. Timer/Pomodoro Section Remodel ✅ DONE
**Type:** Remodel existing (`/tools/timer`)
Full redesign: split 749-line monolith into focused components, thick glowing ring with framer-motion, animated pill toggle between Countdown/Stopwatch/Pomodoro, segmented ring for pomodoro sessions, click-to-edit time (no more +/- buttons), inline settings.

## 2. Habit Tracker ✅ DONE
**Type:** Home widget (generalized widget system)
Shipped as a home-page widget. Each habit is a card with a monthly top-left-aligned grid and streak counter. Widgets share a row, wrap, and are added via an icon-grid popup (unified framework for future widget types — timer, todo, weather, clock, stats).

## 3. Todo Remodel (Deadlines + Urgency)
**Type:** Remodel existing (`/todo`)
Add due dates to todos with color-coded urgency indicators (red = due soon, orange = upcoming, green = comfortable). Sort by deadline. Show on calendar.

## 4. Notes Remodel (Markdown)
**Type:** Remodel existing (`/notes`)
Replace or enhance the current contenteditable editor with markdown editing and live preview. Headings, bold, code blocks, math symbols. Keep PDF export.

## 5. Live Sports Scores
**Type:** Enhance existing (`/sport`)
Real-time scores for followed teams/events on the Sport page. Auto-updating without refresh.

## 6. Home: Active Widgets Only
**Type:** Enhance existing (`/`) — partially covered by #2
The widget framework from #2 already supports this for habits. Remaining scope: build a **Timer widget** that appears in the Widgets section only when a pomodoro is actively running (and optionally other "status" widgets that auto-hide).

## 7. Visual Remodelling of Dashboard
**Type:** Visual overhaul (all pages)
Refresh the visual design across the entire dashboard — layout, spacing, typography, colors, component styling. Scope TBD per page during brainstorming.
