import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

/**
 * Dev plugin that intercepts `POST /api/report` BEFORE the `/api/*`
 * proxy hands it off to the production backend, so reports filed
 * during `npm run dev` land in the local repo's `reports/{type}s.md`
 * rather than polluting the prod log.
 *
 * Endpoint: POST /api/report
 *   body: { type: 'bug' | 'feature', title: string, body: string, page?: string }
 *
 * Mirrors the wire format of the production `/api/report` handler in
 * `server/api.py` exactly, so a built/deployed app and a dev session
 * write identical-shaped markdown entries.
 *
 * Plugin's `configureServer` calls `server.middlewares.use` directly
 * (not via the returned function), which installs the middleware
 * BEFORE Vite's internal proxy middleware — that's how we beat the
 * `/api/*` proxy in `vite.config.ts`.
 */

const REPORT_TYPES = new Set(['bug', 'feature']);
const MAX_FIELD_LEN = 8000;
const MAX_PAYLOAD_BYTES = 64_000;

interface ReportPayload {
  type: 'bug' | 'feature';
  title: string;
  body: string;
  page?: string;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_PAYLOAD_BYTES) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// Strip C0 control characters (except \t \n \r) so crafted payloads can't
// smuggle null bytes or escape sequences into the markdown log.
function stripControl(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code === 9 || code === 10 || code === 13) {
      out += value[i];
      continue;
    }
    if (code < 0x20 || code === 0x7f) continue;
    out += value[i];
  }
  return out;
}

function sanitize(value: unknown, maxLen = MAX_FIELD_LEN): string {
  if (typeof value !== 'string') return '';
  return stripControl(value).slice(0, maxLen).trim();
}

function parsePayload(raw: string): ReportPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const obj = parsed as Record<string, unknown>;
  const type = sanitize(obj.type, 16);
  const title = sanitize(obj.title, 200);
  const body = sanitize(obj.body);
  const page = sanitize(obj.page, 200);

  if (!REPORT_TYPES.has(type)) return null;
  if (!title) return null;

  return {
    type: type as 'bug' | 'feature',
    title,
    body,
    page: page || undefined,
  };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function timestamp(): string {
  const d = new Date();
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  );
}

function fileHeader(type: 'bug' | 'feature'): string {
  const noun = type === 'bug' ? 'Bug reports' : 'Feature requests';
  return `# ${noun}\n\n<!-- Append-only log. Newest entries at the bottom. Edit \`status:\` by hand to mark items as resolved/done. -->\n`;
}

function renderEntry(report: ReportPayload): string {
  const meta: string[] = [];
  if (report.page) meta.push(`- **page**: \`${report.page}\``);
  meta.push('- **status**: open');

  const bodyBlock = report.body ? `\n${report.body}\n` : '';

  return [
    '',
    '---',
    '',
    `### ${timestamp()} — ${report.title}`,
    '',
    meta.join('\n'),
    bodyBlock,
  ].join('\n');
}

async function appendReport(rootDir: string, report: ReportPayload): Promise<string> {
  const dir = path.join(rootDir, 'reports');
  const file = path.join(dir, `${report.type}s.md`);

  await fs.mkdir(dir, { recursive: true });

  let exists = true;
  try {
    await fs.access(file);
  } catch {
    exists = false;
  }

  if (!exists) {
    await fs.writeFile(file, fileHeader(report.type), 'utf8');
  }

  await fs.appendFile(file, renderEntry(report), 'utf8');
  return file;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export function reportsDevPlugin(): Plugin {
  return {
    name: 'dashboard-reports-dev',
    apply: 'serve',
    configureServer(server) {
      const rootDir = server.config.root;

      server.middlewares.use('/api/report', async (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }

        try {
          const raw = await readBody(req);
          const report = parsePayload(raw);
          if (!report) {
            send(res, 400, { error: 'invalid payload' });
            return;
          }
          const file = await appendReport(rootDir, report);
          send(res, 200, { ok: true, file: path.relative(rootDir, file) });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'unknown error';
          server.config.logger.warn(`[reports] failed to write: ${message}`);
          send(res, 500, { error: 'write failed' });
        }
      });
    },
  };
}

export const __test = {
  parsePayload,
  renderEntry,
  fileHeader,
  stripControl,
  sanitize,
};
