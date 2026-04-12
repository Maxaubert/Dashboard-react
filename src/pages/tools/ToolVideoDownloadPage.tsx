import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Download,
  Loader2,
  Video,
  Music,
  ExternalLink,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { cn } from '@/lib/cn';

/**
 * Video downloader — wraps yt-dlp on the backend. Two-step flow:
 *   1. Probe the URL with /api/tools/video/info → preview card.
 *   2. User picks quality → POST /api/tools/video/download → file stream.
 *
 * The download is initiated via a hidden form/anchor so the browser
 * handles the streaming response as a regular file save.
 */
interface VideoInfo {
  title: string;
  thumbnail: string | null;
  uploader: string;
  duration: number;
  durationStr: string;
  webpageUrl: string;
  extractor: string;
  hasFormats: {
    '360p':  boolean;
    '480p':  boolean;
    '720p':  boolean;
    '1080p': boolean;
    best:    boolean;
    audio:   boolean;
  };
}

type Quality = '1080p' | '720p' | '480p' | '360p' | 'audio';

const QUALITY_LABELS: Record<Quality, string> = {
  '1080p': '1080p',
  '720p':  '720p',
  '480p':  '480p',
  '360p':  '360p',
  audio:   'Lyd (MP3)',
};

export function ToolVideoDownloadPage() {
  const [url, setUrl] = useState('');
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [probing, setProbing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quality, setQuality] = useState<Quality>('720p');

  async function probe(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || probing) return;
    setProbing(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch('/api/tools/video/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Feil ${res.status}`);
      } else {
        setInfo(data as VideoInfo);
        // Auto-pick the best quality the video has
        if (data.hasFormats['720p']) setQuality('720p');
        else if (data.hasFormats['480p']) setQuality('480p');
        else if (data.hasFormats['1080p']) setQuality('1080p');
        else if (data.hasFormats['360p']) setQuality('360p');
        else if (data.hasFormats.audio) setQuality('audio');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nettverksfeil');
    } finally {
      setProbing(false);
    }
  }

  async function download() {
    if (!info || downloading) return;
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch('/api/tools/video/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, quality }),
      });
      if (!res.ok) {
        // Try to read JSON error if present
        let errMsg = `Feil ${res.status}`;
        try {
          const data = await res.json();
          errMsg = data.error || errMsg;
        } catch {
          /* keep default */
        }
        setError(errMsg);
        return;
      }
      // Pull the suggested filename from Content-Disposition
      const cd = res.headers.get('content-disposition') || '';
      const match = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
      const filename = match ? decodeURIComponent(match[1]) : 'video.mp4';

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nettverksfeil');
    } finally {
      setDownloading(false);
    }
  }

  const QUALITIES: Quality[] = ['1080p', '720p', '480p', '360p', 'audio'];

  return (
    <div className="page">
      <Link to="/tools" className="tools-back-link tools-back-link-eyebrow">
        ← Verktøy
      </Link>
      <PageHeader
        title="Video-nedlaster"
        subtitle="Last ned video eller lyd fra nettet."
      />

      <form onSubmit={probe} className="reader-form">
        <div className="reader-input-wrap vid-input-wrap">
          <Video size={18} className="reader-input-icon" />
          <input
            type="url"
            placeholder="https://www.youtube.com/watch?v=…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="reader-input"
            spellCheck={false}
            autoFocus
            disabled={probing || downloading}
          />
          <button
            type="submit"
            className="reader-submit vid-submit"
            disabled={probing || downloading || !url.trim()}
          >
            {probing ? <Loader2 size={16} className="reader-spin" /> : 'Hent info'}
          </button>
        </div>
      </form>

      {error && (
        <div className="reader-error">
          <strong>Klarte ikke å hente video.</strong>
          <span>{error}</span>
        </div>
      )}

      {info && (
        <div className="vid-card">
          <div className="vid-card-thumb-wrap">
            {info.thumbnail ? (
              <img
                src={info.thumbnail}
                alt=""
                className="vid-card-thumb"
                loading="lazy"
              />
            ) : (
              <div className="vid-card-thumb vid-card-thumb-empty">
                <Video size={42} />
              </div>
            )}
            <span className="vid-card-duration">{info.durationStr}</span>
          </div>
          <div className="vid-card-body">
            <a
              href={info.webpageUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="vid-card-source"
            >
              {info.extractor}
              <ExternalLink size={11} />
            </a>
            <h2 className="vid-card-title">{info.title}</h2>
            {info.uploader && (
              <div className="vid-card-uploader">{info.uploader}</div>
            )}

            <div className="vid-quality-label">Velg kvalitet</div>
            <div className="vid-quality-grid">
              {QUALITIES.map((q) => {
                const available = q === 'audio' ? info.hasFormats.audio : info.hasFormats[q];
                return (
                  <button
                    key={q}
                    type="button"
                    className={cn(
                      'vid-quality-btn',
                      quality === q && 'active',
                      !available && 'disabled'
                    )}
                    disabled={!available || downloading}
                    onClick={() => setQuality(q)}
                  >
                    {q === 'audio' && <Music size={14} />}
                    {QUALITY_LABELS[q]}
                  </button>
                );
              })}
            </div>

            <div className="vid-card-actions">
              <button
                type="button"
                className="vid-download-btn"
                onClick={download}
                disabled={downloading}
              >
                {downloading ? (
                  <>
                    <Loader2 size={16} className="reader-spin" />
                    Laster ned…
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Last ned {QUALITY_LABELS[quality]}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
