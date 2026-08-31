/**
 * Maps Supabase Auth error messages (English) to the Norwegian strings shown
 * on the login and signup pages. Matching is substring-based because
 * Supabase only exposes free-text messages to the client.
 */

export const AUTH_ERROR_FALLBACK = 'Noe gikk galt. Prøv igjen.';

/** Ordered: the first matching rule wins, so specific phrases come first. */
const RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/already registered|already been registered|already exists/, 'E-posten er allerede registrert.'],
  [/email not confirmed/, 'E-posten er ikke bekreftet. Sjekk innboksen din.'],
  [/signups? .*(not allowed|disabled)|signup is disabled/, 'Registrering er stengt.'],
  [/password should|weak password|password is too/, 'Passordet er for svakt. Bruk minst 10 tegn.'],
  [/validate email|invalid email|invalid format/, 'Ugyldig e-postadresse.'],
  [/invalid login|invalid credentials|invalid grant|credentials/, 'Feil e-post eller passord.'],
  [/rate limit|too many/, 'For mange forsøk. Vent litt og prøv igjen.'],
  [/failed to fetch|network|load failed|fetch/, 'Fikk ikke kontakt med serveren. Sjekk nettet og prøv igjen.'],
];

/** Returns the Norwegian message for a thrown auth error (or raw message). */
export function mapAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  const msg = raw.toLowerCase();
  if (!msg) return AUTH_ERROR_FALLBACK;
  for (const [pattern, text] of RULES) {
    if (pattern.test(msg)) return text;
  }
  return AUTH_ERROR_FALLBACK;
}
