<div align="center">

# Dashboard

</div>

<p align="center"><b>A unified personal dashboard for daily routines, study, and quick tools.</b><br><i>One React SPA replacing a folder of standalone HTML pages.</i></p>

<p align="center"><a href="https://37-27-210-14.sslip.io"><b>Live site</b></a> &middot; login required</p>

<table>
<tr>
<th align="center" width="25%">Hub</th>
<th align="center" width="25%">Daily</th>
<th align="center" width="25%">Toolbox</th>
<th align="center" width="25%">Gaming</th>
</tr>
<tr>
<td valign="top">
<ul>
<li>Today's events</li>
<li>Widgets</li>
<li>External links</li>
<li>Quick prompt to AI</li>
<li>News feed</li>
</ul>
</td>
<td valign="top">
<ul>
<li>Plan (weekly calendar)</li>
<li>Todo (priorities, kanban)</li>
<li>Skole (announcements)</li>
<li>Sport (TV schedule)</li>
<li>Notes</li>
<li>Links library</li>
</ul>
</td>
<td valign="top">
<ul>
<li>Calculator</li>
<li>QR generator</li>
<li>Timer &amp; Pomodoro</li>
<li>PDF tools</li>
<li>Reader mode</li>
<li>Video downloader</li>
<li>Background remover</li>
<li>File converter</li>
</ul>
</td>
<td valign="top">
<ul>
<li>Fetches Steam wishlist</li>
<li>Tracks sales</li>
<li>Price history via ITAD API</li>
<li>Steam events calendar</li>
</ul>
</td>
</tr>
</table>

<p align="center">
  <img src="screenshots/01-home.png" alt="Dashboard home" width="100%">
</p>

---

## Screenshots

<table>
<tr>
<td width="50%"><img src="screenshots/07-gaming.png" alt="Gaming"><br><sub><b>Gaming.</b> Steam wishlist with sale badges and price tags.</sub></td>
<td width="50%"><img src="screenshots/07b-gaming-detail.png" alt="Gaming detalj"><br><sub><b>Price history.</b> ITAD chart and Steam link when you click a game.</sub></td>
</tr>
<tr>
<td><img src="screenshots/02-plan.png" alt="Plan"><br><sub><b>Plan.</b> Weekly calendar with the class schedule.</sub></td>
<td><img src="screenshots/03-todo.png" alt="Todo"><br><sub><b>Todo.</b> Active and completed tasks, list or kanban view.</sub></td>
</tr>
<tr>
<td><img src="screenshots/06-sport.png" alt="Sport"><br><sub><b>Sport.</b> TV schedule for football, cross-country, and biathlon.</sub></td>
<td><img src="screenshots/09-tools.png" alt="Verktoy"><br><sub><b>Toolbox.</b> Card grid linking to all eight built-in utilities.</sub></td>
</tr>
<tr>
<td><img src="screenshots/11-tools-qr.png" alt="QR-kode generator"><br><sub><b>QR.</b> Generate a code from any link or piece of text.</sub></td>
<td><img src="screenshots/12-tools-timer.png" alt="Timer"><br><sub><b>Timer &amp; Pomodoro.</b> Alarm, timer, stopwatch, and Pomodoro in one tool.</sub></td>
</tr>
</table>

## Stack

React 18, TypeScript, Vite, Tailwind v4, React Router v6, TanStack Query, Radix UI primitives, dnd-kit, react-markdown. Backend is a Python API on a separate host; nginx proxies `/api/*` in production and the Vite proxy forwards it in dev.

## Layout

```
src/
  api/          API client, per-endpoint modules, shared types
  hooks/        TanStack Query wrappers, one per domain
  components/
    layout/     AppShell, Sidebar, MobileDrawer, PageHeader
    ui/         Primitives: Button, Card, Modal, Input, Badge, Toast, ...
    patterns/   SortableList, HorizontalScroller, IconPicker, PdfViewer, ...
    widgets/    Composable home-page widgets
    calculator/ Calculator engine and panels
    timer/      Timer, stopwatch, Pomodoro
    links/      Link library popup and editors
    launcher/   Quick-prompt launcher
  pages/        One file per route
  styles/       globals.css with design tokens
  lib/          Utilities (cn, dates, ...)
screenshots/    Captured via capture.mjs (puppeteer-core + system Edge)
```
