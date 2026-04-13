/**
 * Generate a reasonably-unique id. Uses crypto.randomUUID when available
 * (HTTPS / localhost) and falls back to a timestamp+random suffix on
 * insecure contexts (plain HTTP), where randomUUID is gated off.
 */
export function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
