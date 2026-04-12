/**
 * PDF helper — `api.py` exposes /api/pdf?lab=N or /api/pdf?stat=NAME and
 * streams the binary file. The PdfViewer component just points an iframe
 * at one of these URLs; we don't need to fetch the bytes ourselves.
 */
export function pdfUrl(opts: { lab?: string | number; stat?: string }): string {
  const params = new URLSearchParams();
  if (opts.lab !== undefined) params.set('lab', String(opts.lab));
  if (opts.stat) params.set('stat', opts.stat);
  return `/api/pdf?${params.toString()}`;
}

export function faviconUrl(domain: string): string {
  return `/api/favicon?domain=${encodeURIComponent(domain)}`;
}
