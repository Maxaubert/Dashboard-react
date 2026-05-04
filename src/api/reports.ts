/**
 * Frontend client for the in-app bug/feature report log.
 *
 * Hits `POST /api/report`. In production, nginx proxies `/api/*` to
 * `api.py` on `127.0.0.1:3001`, which appends the entry to
 * `/opt/dashboard/reports/{type}s.md`. In dev, the Vite dev plugin
 * (`vite-plugins/reports.ts`) intercepts `/api/report` BEFORE the
 * `/api/*` proxy fires, so dev writes land in the local repo's
 * `reports/` folder instead of hitting prod.
 */

export type ReportType = 'bug' | 'feature';

export interface ReportInput {
  type: ReportType;
  title: string;
  body: string;
  page?: string;
}

export interface ReportResponse {
  ok: true;
  file: string;
}

export class ReportSubmitError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ReportSubmitError';
    this.status = status;
  }
}

export async function submitReport(input: ReportInput): Promise<ReportResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('timeout')), 5000);

  try {
    const res = await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    if (!res.ok) {
      let detail = res.statusText;
      try {
        const text = await res.text();
        if (text) detail = text;
      } catch {
        /* keep statusText */
      }
      throw new ReportSubmitError(detail, res.status);
    }

    return (await res.json()) as ReportResponse;
  } finally {
    clearTimeout(timeout);
  }
}
