/**
 * Tiny fetch wrapper — does the things every endpoint module needs:
 *   - Prepends a base URL (configurable per environment)
 *   - JSON body serialization + parsing
 *   - Timeout via AbortController
 *   - Throws ApiError on non-2xx so TanStack Query treats it as an error
 *
 * The base URL is intentionally relative ("/api") in production. nginx
 * proxies /api/* to the Python backend on 127.0.0.1:3001. In dev, Vite's
 * proxy (see vite.config.ts) forwards /api/* to the live host so the React
 * app talks to the real backend without any code change.
 */

const BASE_URL = '/api';
const DEFAULT_TIMEOUT_MS = 8000;

export class ApiError extends Error {
  status: number;
  url: string;

  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
  }
}

interface RequestOptions {
  /** Query string params (will be URL-encoded). */
  params?: Record<string, string | number | undefined | null>;
  /** Body to JSON-serialize for POST/PUT/PATCH. */
  body?: unknown;
  /** Override the default 8s timeout. */
  timeoutMs?: number;
  /** Pass-through extra headers. */
  headers?: Record<string, string>;
  /** Forwarded AbortSignal — combined with the internal timeout signal. */
  signal?: AbortSignal;
}

function buildUrl(path: string, params?: RequestOptions['params']): string {
  const url = path.startsWith('http') ? path : BASE_URL + path;
  if (!params) return url;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${url}?${qs}` : url;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const url = buildUrl(path, options.params);

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new Error('timeout')),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

  // Combine the user-supplied signal (if any) with our timeout signal so
  // either source can cancel the request.
  if (options.signal) {
    if (options.signal.aborted) controller.abort(options.signal.reason);
    else options.signal.addEventListener('abort', () => controller.abort(options.signal?.reason));
  }

  try {
    const response = await fetch(url, {
      method,
      headers: {
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = response.statusText;
      try {
        const text = await response.text();
        if (text) detail = text;
      } catch {
        /* ignore — we already have statusText */
      }
      throw new ApiError(detail, response.status, url);
    }

    // 204 / empty body
    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return (await response.json()) as T;
    }
    // Plain text fallback (shouldn't happen for our API, but be safe)
    return (await response.text()) as unknown as T;
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PUT', path, { ...options, body }),
  del: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
};
