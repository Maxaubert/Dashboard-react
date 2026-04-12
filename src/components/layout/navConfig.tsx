import {
  CalendarIcon,
  CheckSquareIcon,
  GraduationCapIcon,
  NotebookIcon,
  TrophyIcon,
  GamepadIcon,
  WrenchIcon,
} from './navIcons';
import type { ReactNode } from 'react';

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  /** Page accent color CSS variable. */
  accent: string;
}

/**
 * Sidebar nav — matches the legacy nav.js exactly.
 *
 *   - The dashboard logo at the top of the sidebar links to "/" (Home).
 *     Home is intentionally NOT in this list.
 *   - Lenker is intentionally NOT here either; it lives behind the
 *     "Alle" link in the home page's "Eksterne lenker" section.
 *   - There is no Chat — that page was removed.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/plan',     label: 'Plan',     icon: <CalendarIcon />,      accent: 'var(--color-page-plan)' },
  { to: '/todo',     label: 'Todo',     icon: <CheckSquareIcon />,   accent: 'var(--color-page-todo)' },
  { to: '/skole',    label: 'Skole',    icon: <GraduationCapIcon />, accent: 'var(--color-page-skole)' },
  { to: '/notes',    label: 'Notater',  icon: <NotebookIcon />,      accent: 'var(--color-page-notes)' },
  { to: '/sport',    label: 'Sport',    icon: <TrophyIcon />,        accent: 'var(--color-page-sport)' },
  { to: '/gaming',   label: 'Gaming',   icon: <GamepadIcon />,       accent: 'var(--color-page-gaming)' },
  { to: '/tools',    label: 'Verktøy',  icon: <WrenchIcon />,        accent: 'var(--color-page-links)' },
];
