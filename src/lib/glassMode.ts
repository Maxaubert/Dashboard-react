/**
 * Constants + helper for transparent (Nebula) glass mode.
 *
 * The React state lives in GlassModeContext; this module holds the pure,
 * framework-free bits so they are unit-testable without React.
 */

/** localStorage key (matches the app's unprefixed view-pref keys). */
export const GLASS_MODE_KEY = 'glass-mode';

/** Body class that activates src/styles/glass.css. */
export const GLASS_MODE_CLASS = 'glass-mode';

/** Off by default: the effect only renders inside Zen with Mica. */
export const GLASS_MODE_DEFAULT = false;

/** Add/remove the body class. Safe when there is no document (SSR/tests). */
export function applyGlassModeClass(enabled: boolean): void {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle(GLASS_MODE_CLASS, enabled);
}
