import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eraser, Upload, Loader2, Download, X, Image as ImageIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

/**
 * Background remover. Sends an uploaded image to /api/tools/bgremove,
 * which runs rembg + onnxruntime CPU on the server. Shows a side-by-
 * side before/after with a checkerboard background on the result so
 * the transparent areas are visible.
 *
 * The first request after a server restart can take 30+ seconds while
 * rembg downloads the ~175 MB U²-Net model. Subsequent requests are
 * fast (~2-5 seconds).
 */
export function ToolBgRemovePage() {
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Filen er ikke et bilde.');
      return;
    }
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setOriginalFile(file);
    setOriginalUrl(URL.createObjectURL(file));
    setResultUrl(null);
    setError(null);
  }, [originalUrl, resultUrl]);

  function reset() {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setOriginalFile(null);
    setOriginalUrl(null);
    setResultUrl(null);
    setError(null);
  }

  async function process() {
    if (!originalFile || loading) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', originalFile);
      const res = await fetch('/api/tools/bgremove', { method: 'POST', body: fd });
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
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      setResultUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nettverksfeil');
    } finally {
      setLoading(false);
    }
  }

  function downloadResult() {
    if (!resultUrl || !originalFile) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    const base = originalFile.name.replace(/\.[^.]+$/, '');
    a.download = `${base}-no-bg.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
  }

  return (
    <div className="page">
      <Link to="/tools" className="tools-back-link tools-back-link-eyebrow">
        ← Verktøy
      </Link>
      <PageHeader
        title="Bakgrunnsfjerner"
        subtitle="Fjern bakgrunnen fra et bilde."
      />

      {!originalUrl && (
        <div
          className={`bgr-dropzone${dragging ? ' dragging' : ''}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          <div className="bgr-dropzone-icon">
            <Upload size={32} strokeWidth={1.5} />
          </div>
          <div className="bgr-dropzone-title">Drop et bilde her</div>
          <div className="bgr-dropzone-sub">eller klikk for å velge en fil</div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              // Reset so re-selecting the same file fires onChange again
              e.target.value = '';
            }}
          />
        </div>
      )}

      {error && (
        <div className="reader-error">
          <strong>Klarte ikke å fjerne bakgrunnen.</strong>
          <span>{error}</span>
        </div>
      )}

      {originalUrl && (
        <div className="bgr-workspace">
          <div className="bgr-pair">
            <div className="bgr-img-card">
              <div className="bgr-img-label">FØR</div>
              <div className="bgr-img-frame">
                <img src={originalUrl} alt="Original" />
              </div>
            </div>
            <div className="bgr-img-card">
              <div className="bgr-img-label">ETTER</div>
              <div className="bgr-img-frame bgr-checker">
                {resultUrl ? (
                  <img src={resultUrl} alt="Uten bakgrunn" />
                ) : loading ? (
                  <div className="bgr-img-empty">
                    <Loader2 size={32} className="reader-spin" />
                    <span>Behandler…</span>
                  </div>
                ) : (
                  <div className="bgr-img-empty">
                    <ImageIcon size={32} strokeWidth={1.4} />
                    <span>Klikk «Fjern bakgrunn» for å starte</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bgr-actions">
            {!resultUrl ? (
              <button
                type="button"
                className="bgr-primary-btn"
                onClick={process}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="reader-spin" /> Behandler…
                  </>
                ) : (
                  <>
                    <Eraser size={16} /> Fjern bakgrunn
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                className="bgr-primary-btn"
                onClick={downloadResult}
              >
                <Download size={16} /> Last ned PNG
              </button>
            )}
            <button
              type="button"
              className="reader-action"
              onClick={reset}
              disabled={loading}
            >
              <X size={14} /> Bytt bilde
            </button>
          </div>

          {originalFile && (
            <div className="bgr-meta">
              {originalFile.name} · {Math.round(originalFile.size / 1024)} KB
            </div>
          )}
        </div>
      )}
    </div>
  );
}
