/**
 * Sidebar icons — ported VERBATIM from the legacy `nav.js`. These are
 * filled (`fill="currentColor"`), not stroke-based, and use the exact
 * paths from the original site so the sidebar matches pixel-for-pixel.
 */

type IconProps = { size?: number; className?: string };

function svg(d: string, viewBox = '0 0 24 24', size = 15, className?: string) {
  return (
    <svg width={size} height={size} viewBox={viewBox} fill="currentColor" className={className}>
      <path d={d} />
    </svg>
  );
}

export function CalendarIcon({ size = 15, className }: IconProps = {}) {
  return svg(
    'M19 3h-1V1h-2v2H8V1H6v2H5C3.9 3 3 3.9 3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z',
    '0 0 24 24',
    size,
    className
  );
}

export function CheckSquareIcon({ size = 15, className }: IconProps = {}) {
  return svg(
    'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
    '0 0 24 24',
    size,
    className
  );
}

export function NotebookIcon({ size = 15, className }: IconProps = {}) {
  return svg(
    'M3 18h12v-2H3v2zm0-5h12v-2H3v2zm0-7v2h12V6H3zm14 9.34V7h-2v11.34l1 .66 1-.66z',
    '0 0 24 24',
    size,
    className
  );
}

export function TrophyIcon({ size = 15, className }: IconProps = {}) {
  // Legacy uses a Font Awesome torch icon (576x512 viewBox).
  return svg(
    'M336 96a48 48 0 1 0 -96 0 48 48 0 1 0 96 0zM244.6 144.4c-9.2-3.4-16.9-9.6-22-17.6l-147-147c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c6 6 14.1 9.3 22.6 9.3l64.1 0zM224 256l0 128-64 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l128 0 128 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-64 0 0-128 0-50.7 129.5-129.5c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 158.6 266.6 137.3c3.5 8.1 5.4 17 5.4 26.3l0 32.7L224 196.9 224 256z',
    '0 0 576 512',
    size,
    className
  );
}

export function GamepadIcon({ size = 15, className }: IconProps = {}) {
  return svg(
    'M21 6H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1zm-10 9H8v-3H5v-2h3V7h2v3h3v2h-3v3zm4.5 1a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-3a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
    '0 0 24 24',
    size,
    className
  );
}

// Home / Lenker / Chat — kept for compatibility with HomePage's
// CategoryDef icons. Filled to match the legacy style.
export function HomeIcon({ size = 15, className }: IconProps = {}) {
  return svg(
    'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
    '0 0 24 24',
    size,
    className
  );
}

export function LinkIcon({ size = 15, className }: IconProps = {}) {
  return svg(
    'M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 8H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-2zm1-4H8v2h8v-2z',
    '0 0 24 24',
    size,
    className
  );
}

export function MessageSquareIcon({ size = 15, className }: IconProps = {}) {
  return svg(
    'M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z',
    '0 0 24 24',
    size,
    className
  );
}

// Chrome icons (still stroke-based — only used by mobile drawer)
export function MenuIcon({ size = 20, className }: IconProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function CloseIcon({ size = 20, className }: IconProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function SearchIcon({ size = 16, className }: IconProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </svg>
  );
}
