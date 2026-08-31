/** Favicon via Google's public service (works as an <img> src, no proxy). */
export function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}
