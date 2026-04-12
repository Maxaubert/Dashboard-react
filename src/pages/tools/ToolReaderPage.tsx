import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Copy, Check, Loader2, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

/**
 * Reader mode tool — fetches a URL via the backend, runs it through
 * readability-lxml on the server, and renders just the article content
 * in a clean serif-ish layout. Strips ads, sidebars, cookie banners,
 * and the rest of the page chrome.
 */
interface ReaderResult {
  title: string;
  byline: string | null;
  domain: string;
  content: string; // HTML
  text: string; // plain text fallback
  length: number;
}

export function ToolReaderPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReaderResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/tools/reader', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Feil ${res.status}`);
      } else {
        setResult(data as ReaderResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nettverksfeil');
    } finally {
      setLoading(false);
    }
  }

  async function copyText() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  function reset() {
    setUrl('');
    setResult(null);
    setError(null);
  }

  return (
    <div className="page">
      <Link to="/tools" className="tools-back-link tools-back-link-eyebrow">
        ← Verktøy
      </Link>
      <PageHeader
        title="Reader mode"
        subtitle="Les en artikkel uten reklame eller rot."
      />

      <form onSubmit={handleSubmit} className="reader-form">
        <div className="reader-input-wrap">
          <BookOpen size={18} className="reader-input-icon" />
          <input
            type="url"
            placeholder="https://example.com/artikkel"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="reader-input"
            spellCheck={false}
            autoFocus
            disabled={loading}
          />
          <button
            type="submit"
            className="reader-submit"
            disabled={loading || !url.trim()}
          >
            {loading ? <Loader2 size={16} className="reader-spin" /> : 'Hent'}
          </button>
        </div>
      </form>

      {error && (
        <div className="reader-error">
          <strong>Klarte ikke å hente artikkelen.</strong>
          <span style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
            {error}
          </span>
        </div>
      )}

      {result && (
        <article className="reader-article">
          <header className="reader-article-header">
            <div className="reader-article-meta">
              <a
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="reader-article-domain"
              >
                {result.domain}
                <ExternalLink size={11} />
              </a>
              <span className="reader-article-length">
                {result.length.toLocaleString('no-NO')} tegn
              </span>
            </div>
            <h1 className="reader-article-title">{result.title || 'Uten tittel'}</h1>
            <div className="reader-article-actions">
              <button type="button" className="reader-action" onClick={copyText}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Kopiert' : 'Kopier ren tekst'}
              </button>
              <button type="button" className="reader-action" onClick={reset}>
                Ny artikkel
              </button>
            </div>
          </header>
          <div
            className="reader-article-body"
            dangerouslySetInnerHTML={{ __html: result.content }}
          />
        </article>
      )}
    </div>
  );
}
