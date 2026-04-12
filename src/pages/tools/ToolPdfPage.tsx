import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Loader2,
  Upload,
  X,
  ArrowDown,
  ArrowUp,
  GripVertical,
  Type,
  Image as ImageIcon,
  RotateCw,
  Layers,
  Scissors,
  Minimize2,
  type LucideIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { cn } from '@/lib/cn';

/**
 * PDF tools — multi-tab utility with six operations:
 *   - Slå sammen (merge multiple PDFs)
 *   - Splitt (extract a page range)
 *   - Roter (rotate pages)
 *   - Komprimer (best-effort compression)
 *   - Hent ut tekst (text extraction)
 *   - Til bilder (rasterize each page to PNG, zipped)
 *
 * Each tab is its own self-contained component so state doesn't leak
 * between operations when the user switches.
 */
type Tab = 'merge' | 'split' | 'rotate' | 'compress' | 'text' | 'images';

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'merge',    label: 'Slå sammen', icon: Layers },
  { id: 'split',    label: 'Splitt',     icon: Scissors },
  { id: 'rotate',   label: 'Roter',      icon: RotateCw },
  { id: 'compress', label: 'Komprimer',  icon: Minimize2 },
  { id: 'text',     label: 'Hent tekst', icon: Type },
  { id: 'images',   label: 'Til bilder', icon: ImageIcon },
];

export function ToolPdfPage() {
  const [tab, setTab] = useState<Tab>('merge');

  return (
    <div className="page">
      <Link to="/tools" className="tools-back-link tools-back-link-eyebrow">
        ← Verktøy
      </Link>
      <PageHeader
        title="PDF-verktøy"
        subtitle="Slå sammen, splitt, roter eller komprimer PDF-er."
      />

      <div className="pdf-tabs" role="tablist">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={cn('pdf-tab', tab === t.id && 'active')}
              onClick={() => setTab(t.id)}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="pdf-tab-body">
        {tab === 'merge' && <MergeTab />}
        {tab === 'split' && <SplitTab />}
        {tab === 'rotate' && <RotateTab />}
        {tab === 'compress' && <CompressTab />}
        {tab === 'text' && <ExtractTextTab />}
        {tab === 'images' && <ToImagesTab />}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Shared helpers                                                         */
/* ────────────────────────────────────────────────────────────────────── */

function FileDrop({
  onFile,
  multiple,
  accept = '.pdf,application/pdf',
  hint,
}: {
  onFile: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  hint?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const list = Array.from(e.dataTransfer.files).filter((f) =>
      f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (list.length) onFile(multiple ? list : [list[0]]);
  }

  return (
    <div
      className={`pdf-dropzone${dragging ? ' dragging' : ''}`}
      onDrop={onDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragging(false);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
    >
      <Upload size={26} strokeWidth={1.5} className="pdf-dropzone-icon" />
      <div className="pdf-dropzone-title">
        {multiple ? 'Drop PDF-er her' : 'Drop en PDF her'}
      </div>
      <div className="pdf-dropzone-sub">{hint || 'eller klikk for å velge'}</div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          const list = Array.from(e.target.files || []);
          if (list.length) onFile(list);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="reader-error">
      <strong>Noe gikk galt.</strong>
      <span>{message}</span>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function postWithError<T = Blob>(
  url: string,
  body: FormData,
  expectJson = false,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { method: 'POST', body });
    if (!res.ok) {
      try {
        const err = await res.json();
        return { ok: false, error: err.error || `Feil ${res.status}` };
      } catch {
        return { ok: false, error: `Feil ${res.status}` };
      }
    }
    const data = (expectJson ? await res.json() : await res.blob()) as T;
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Nettverksfeil' };
  }
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Merge tab                                                              */
/* ────────────────────────────────────────────────────────────────────── */

function MergeTab() {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function move(idx: number, delta: number) {
    setFiles((prev) => {
      const next = [...prev];
      const target = idx + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function remove(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit() {
    if (files.length < 2) return;
    setLoading(true);
    setError(null);
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    const r = await postWithError<Blob>('/api/tools/pdf/merge', fd);
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    downloadBlob(r.data, 'sammenslatt.pdf');
  }

  return (
    <>
      <FileDrop
        multiple
        hint="velg flere — rekkefølgen kan endres etter opplasting"
        onFile={(list) => setFiles((prev) => [...prev, ...list])}
      />

      {files.length > 0 && (
        <div className="pdf-file-list">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="pdf-file-row">
              <GripVertical size={14} className="pdf-file-grip" />
              <span className="pdf-file-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="pdf-file-name">{f.name}</span>
              <span className="pdf-file-size">{Math.round(f.size / 1024)} KB</span>
              <button
                type="button"
                className="pdf-file-btn"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label="Flytt opp"
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                className="pdf-file-btn"
                onClick={() => move(i, 1)}
                disabled={i === files.length - 1}
                aria-label="Flytt ned"
              >
                <ArrowDown size={14} />
              </button>
              <button
                type="button"
                className="pdf-file-btn"
                onClick={() => remove(i)}
                aria-label="Fjern"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <ErrorBanner message={error} />

      <div className="pdf-actions">
        <button
          type="button"
          className="pdf-primary-btn"
          onClick={submit}
          disabled={loading || files.length < 2}
        >
          {loading ? <Loader2 size={16} className="reader-spin" /> : <Layers size={16} />}
          Slå sammen {files.length || ''} PDF-er
        </button>
        {files.length > 0 && (
          <button type="button" className="reader-action" onClick={() => setFiles([])}>
            <X size={14} /> Tøm
          </button>
        )}
      </div>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Single-file operations: Split, Rotate, Compress, Text, Images          */
/* ────────────────────────────────────────────────────────────────────── */

function FilePicked({ file, onClear }: { file: File; onClear: () => void }) {
  return (
    <div className="pdf-picked">
      <FileText size={18} className="pdf-picked-icon" />
      <div className="pdf-picked-info">
        <div className="pdf-picked-name">{file.name}</div>
        <div className="pdf-picked-size">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
      </div>
      <button type="button" className="pdf-file-btn" onClick={onClear}>
        <X size={14} />
      </button>
    </div>
  );
}

function SplitTab() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!file || !pages.trim()) return;
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('pages', pages);
    const r = await postWithError<Blob>('/api/tools/pdf/split', fd);
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    downloadBlob(r.data, file.name.replace(/\.pdf$/i, '') + '-sider.pdf');
  }

  return (
    <>
      {!file ? (
        <FileDrop onFile={(list) => setFile(list[0])} />
      ) : (
        <FilePicked file={file} onClear={() => setFile(null)} />
      )}

      <div className="pdf-form-row">
        <label className="pdf-label">
          Sider (eks. <code>1-3,5,7-9</code>)
        </label>
        <input
          type="text"
          className="pdf-text-input"
          placeholder="1-3,5,7-9"
          value={pages}
          onChange={(e) => setPages(e.target.value)}
        />
      </div>

      <ErrorBanner message={error} />

      <div className="pdf-actions">
        <button
          type="button"
          className="pdf-primary-btn"
          onClick={submit}
          disabled={loading || !file || !pages.trim()}
        >
          {loading ? <Loader2 size={16} className="reader-spin" /> : <Scissors size={16} />}
          Splitt
        </button>
      </div>
    </>
  );
}

function RotateTab() {
  const [file, setFile] = useState<File | null>(null);
  const [degrees, setDegrees] = useState<90 | 180 | 270>(90);
  const [pages, setPages] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!file) return;
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('degrees', String(degrees));
    if (pages.trim()) fd.append('pages', pages);
    const r = await postWithError<Blob>('/api/tools/pdf/rotate', fd);
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    downloadBlob(r.data, file.name.replace(/\.pdf$/i, '') + '-rotert.pdf');
  }

  return (
    <>
      {!file ? (
        <FileDrop onFile={(list) => setFile(list[0])} />
      ) : (
        <FilePicked file={file} onClear={() => setFile(null)} />
      )}

      <div className="pdf-form-row">
        <label className="pdf-label">Vinkel</label>
        <div className="pdf-radio-group">
          {([90, 180, 270] as const).map((d) => (
            <button
              key={d}
              type="button"
              className={cn('pdf-radio', degrees === d && 'active')}
              onClick={() => setDegrees(d)}
            >
              {d}°
            </button>
          ))}
        </div>
      </div>

      <div className="pdf-form-row">
        <label className="pdf-label">Sider (tomt = alle)</label>
        <input
          type="text"
          className="pdf-text-input"
          placeholder="1-3,5"
          value={pages}
          onChange={(e) => setPages(e.target.value)}
        />
      </div>

      <ErrorBanner message={error} />

      <div className="pdf-actions">
        <button
          type="button"
          className="pdf-primary-btn"
          onClick={submit}
          disabled={loading || !file}
        >
          {loading ? <Loader2 size={16} className="reader-spin" /> : <RotateCw size={16} />}
          Roter
        </button>
      </div>
    </>
  );
}

function CompressTab() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!file) return;
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.append('file', file);
    const r = await postWithError<Blob>('/api/tools/pdf/compress', fd);
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    downloadBlob(r.data, file.name.replace(/\.pdf$/i, '') + '-komprimert.pdf');
  }

  return (
    <>
      {!file ? (
        <FileDrop onFile={(list) => setFile(list[0])} />
      ) : (
        <FilePicked file={file} onClear={() => setFile(null)} />
      )}

      <p className="pdf-note">
        Lossless content-stream-komprimering. Hjelper mest på PDF-er som ikke
        allerede er optimalisert. Tunge bilde-PDF-er får liten effekt uten
        ghostscript.
      </p>

      <ErrorBanner message={error} />

      <div className="pdf-actions">
        <button
          type="button"
          className="pdf-primary-btn"
          onClick={submit}
          disabled={loading || !file}
        >
          {loading ? <Loader2 size={16} className="reader-spin" /> : <Minimize2 size={16} />}
          Komprimer
        </button>
      </div>
    </>
  );
}

function ExtractTextTab() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ text: string; pages: number; chars: number } | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const fd = new FormData();
    fd.append('file', file);
    const r = await postWithError<{ text: string; pages: number; chars: number }>(
      '/api/tools/pdf/extract-text',
      fd,
      true
    );
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setResult(r.data);
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  function downloadTxt() {
    if (!result || !file) return;
    const blob = new Blob([result.text], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, file.name.replace(/\.pdf$/i, '') + '.txt');
  }

  return (
    <>
      {!file ? (
        <FileDrop onFile={(list) => setFile(list[0])} />
      ) : (
        <FilePicked file={file} onClear={() => setFile(null)} />
      )}

      <ErrorBanner message={error} />

      <div className="pdf-actions">
        <button
          type="button"
          className="pdf-primary-btn"
          onClick={submit}
          disabled={loading || !file}
        >
          {loading ? <Loader2 size={16} className="reader-spin" /> : <Type size={16} />}
          Hent ut tekst
        </button>
      </div>

      {result && (
        <div className="pdf-text-result">
          <div className="pdf-text-meta">
            {result.pages} sider · {result.chars.toLocaleString('no-NO')} tegn
          </div>
          <textarea className="pdf-text-area" value={result.text} readOnly rows={16} />
          <div className="pdf-actions">
            <button type="button" className="pdf-primary-btn" onClick={downloadTxt}>
              Last ned .txt
            </button>
            <button type="button" className="reader-action" onClick={copy}>
              {copied ? 'Kopiert' : 'Kopier'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ToImagesTab() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!file) return;
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.append('file', file);
    const r = await postWithError<Blob>('/api/tools/pdf/to-images', fd);
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    downloadBlob(r.data, file.name.replace(/\.pdf$/i, '') + '-bilder.zip');
  }

  return (
    <>
      {!file ? (
        <FileDrop onFile={(list) => setFile(list[0])} />
      ) : (
        <FilePicked file={file} onClear={() => setFile(null)} />
      )}

      <p className="pdf-note">
        Hver side rendres som PNG ved 150 DPI og pakkes i en ZIP-fil.
      </p>

      <ErrorBanner message={error} />

      <div className="pdf-actions">
        <button
          type="button"
          className="pdf-primary-btn"
          onClick={submit}
          disabled={loading || !file}
        >
          {loading ? <Loader2 size={16} className="reader-spin" /> : <ImageIcon size={16} />}
          Konverter til bilder
        </button>
      </div>
    </>
  );
}

