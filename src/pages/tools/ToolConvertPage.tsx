import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Download,
  FileType2,
  Image as ImageIcon,
  Music,
  Video,
  FileText,
  Loader2,
  Upload,
  X,
  type LucideIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { cn } from '@/lib/cn';

/**
 * Universal file converter — sends a file to /api/tools/convert which
 * dispatches to Pillow (image), ffmpeg (audio/video), or stdlib JSON/CSV
 * (text). On upload, the page first calls /api/tools/convert/info to
 * find out which target formats are valid for the file, then shows
 * those as picker buttons.
 */
type Category = 'image' | 'audio' | 'video' | 'text';

interface ConvertInfo {
  category: Category | null;
  supported: boolean;
  sourceExt: string;
  targets: string[];
}

const CATEGORY_LABELS: Record<Category, string> = {
  image: 'Bilde',
  audio: 'Lyd',
  video: 'Video',
  text:  'Tekst',
};

const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  image: ImageIcon,
  audio: Music,
  video: Video,
  text:  FileText,
};

const CATEGORY_COLOR: Record<Category, string> = {
  image: '#14b8a6',
  audio: '#f97316',
  video: '#ef4444',
  text:  '#6366f1',
};

export function ToolConvertPage() {
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<ConvertInfo | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setInfo(null);
    setTarget(null);
    setError(null);
    setProbing(true);
    try {
      const res = await fetch('/api/tools/convert/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: f.name }),
      });
      const data = (await res.json()) as ConvertInfo;
      setInfo(data);
      if (data.targets.length > 0) setTarget(data.targets[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nettverksfeil');
    } finally {
      setProbing(false);
    }
  }, []);

  function reset() {
    setFile(null);
    setInfo(null);
    setTarget(null);
    setError(null);
  }

  async function convert() {
    if (!file || !target || converting) return;
    setConverting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('target', target);
      const res = await fetch('/api/tools/convert', { method: 'POST', body: fd });
      if (!res.ok) {
        try {
          const data = await res.json();
          setError(data.error || `Feil ${res.status}`);
        } catch {
          setError(`Feil ${res.status}`);
        }
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const base = file.name.replace(/\.[^.]+$/, '');
      a.download = `${base}.${target}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nettverksfeil');
    } finally {
      setConverting(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  const cat = info?.category;
  const Icon = cat ? CATEGORY_ICONS[cat] : FileType2;
  const accent = cat ? CATEGORY_COLOR[cat] : 'rgba(255,255,255,0.4)';

  return (
    <div className="page">
      <Link to="/tools" className="tools-back-link tools-back-link-eyebrow">
        ← Verktøy
      </Link>
      <PageHeader
        title="Fil-konverterer"
        subtitle="Konverter mellom bilde-, lyd- og videoformater."
      />

      {!file && (
        <div
          className={`bgr-dropzone conv-dropzone${dragging ? ' dragging' : ''}`}
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <div className="bgr-dropzone-icon conv-dropzone-icon">
            <Upload size={32} strokeWidth={1.5} />
          </div>
          <div className="bgr-dropzone-title">Drop en fil her</div>
          <div className="bgr-dropzone-sub">eller klikk for å velge</div>
          <div className="conv-cat-row">
            {(['image', 'audio', 'video', 'text'] as const).map((c) => {
              const I = CATEGORY_ICONS[c];
              return (
                <span key={c} className="conv-cat-chip" style={{ color: CATEGORY_COLOR[c] }}>
                  <I size={14} />
                  {CATEGORY_LABELS[c]}
                </span>
              );
            })}
          </div>
          <input
            ref={inputRef}
            type="file"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
        </div>
      )}

      {file && (
        <div className="conv-workspace">
          <div className="conv-source-card" style={{ ['--accent' as string]: accent }}>
            <div className="conv-source-icon">
              <Icon size={26} strokeWidth={1.5} />
            </div>
            <div className="conv-source-info">
              <div className="conv-source-name">{file.name}</div>
              <div className="conv-source-meta">
                {(file.size / 1024 / 1024).toFixed(2)} MB
                {info?.category && (
                  <>
                    <span className="conv-dot">·</span>
                    {CATEGORY_LABELS[info.category]}
                  </>
                )}
                {info?.sourceExt && (
                  <>
                    <span className="conv-dot">·</span>
                    <span className="conv-ext-pill">.{info.sourceExt}</span>
                  </>
                )}
              </div>
            </div>
            <button type="button" className="pdf-file-btn" onClick={reset}>
              <X size={14} />
            </button>
          </div>

          {probing && (
            <div className="conv-probing">
              <Loader2 size={16} className="reader-spin" />
              Sjekker tilgjengelige formater…
            </div>
          )}

          {info && !info.supported && (
            <div className="reader-error">
              <strong>Filtypen «{info.sourceExt || 'ukjent'}» støttes ikke.</strong>
              <span>
                Prøv et bilde (PNG/JPG/WebP), en lydfil (MP3/WAV/FLAC), en video
                (MP4/WebM/MOV) eller en JSON/CSV-fil.
              </span>
            </div>
          )}

          {info && info.supported && (
            <>
              <div className="conv-arrow-row">
                <ArrowRight size={20} className="conv-arrow" />
                <span className="conv-target-label">Konverter til</span>
              </div>

              <div className="conv-target-grid">
                {info.targets.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={cn(
                      'conv-target-btn',
                      target === t && 'active'
                    )}
                    style={{ ['--accent' as string]: accent }}
                    onClick={() => setTarget(t)}
                  >
                    .{t}
                  </button>
                ))}
              </div>

              <div className="pdf-actions">
                <button
                  type="button"
                  className="conv-convert-btn"
                  style={{ ['--accent' as string]: accent }}
                  onClick={convert}
                  disabled={converting || !target}
                >
                  {converting ? (
                    <>
                      <Loader2 size={16} className="reader-spin" />
                      Konverterer…
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      Konverter til .{target}
                    </>
                  )}
                </button>
                <button type="button" className="reader-action" onClick={reset}>
                  Bytt fil
                </button>
              </div>
            </>
          )}

          {error && (
            <div className="reader-error">
              <strong>Konverteringen feilet.</strong>
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
