/**
 * Helpers for the `?steam=` flag that `/api/steam/callback` appends when it
 * redirects back to `/` after the Steam OpenID round-trip. Pure, no React.
 */
export type SteamCallbackStatus = 'connected' | 'error';

/** Reads the callback status from a `location.search` string, or null when absent/unknown. */
export function readSteamCallback(search: string): SteamCallbackStatus | null {
  const value = new URLSearchParams(search).get('steam');
  return value === 'connected' || value === 'error' ? value : null;
}

/** Returns `pathname` plus the remaining query with the `steam` param removed, for `history.replaceState`. */
export function stripSteamParam(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete('steam');
  const rest = params.toString();
  return rest ? `${pathname}?${rest}` : pathname;
}
