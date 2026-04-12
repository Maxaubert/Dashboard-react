import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { faviconUrl } from '@/api/pdf';
import { removeWhiteBg } from '@/lib/removeWhiteBg';
import { SVG_ICONS } from '@/data/svgIcons';
import { cn } from '@/lib/cn';

/**
 * Resolved icon — what gets persisted on a `LinkItem`. Always one of:
 *   { iconType: 'favicon', iconValue: '' }    (renderer derives from URL)
 *   { iconType: 'svg',     iconValue: 'star' } (id from SVG_ICONS)
 *   { iconType: 'image',   iconValue: 'data:image/png;base64,...' }
 */
export interface ResolvedIcon {
  iconType: 'favicon' | 'svg' | 'image';
  iconValue: string;
}

export interface IconPickerHandle {
  /**
   * Returns the final icon to save. If "Fjern hvit/lys bakgrunn" is
   * checked on the favicon or image tab, the source is processed via
   * canvas and returned as an `image` data URL. Otherwise the raw
   * selection is returned.
   */
  resolve: (linkUrl: string) => Promise<ResolvedIcon>;
}

interface IconPickerProps {
  /** Pre-fill the picker from an existing link's icon. */
  initial?: { iconType?: string; iconValue?: string };
  /** Domain hint for the favicon preview before the user types a URL. */
  domainHint?: string;
}

type Tab = 'favicon' | 'svg' | 'image';

function detectInitialTab(initial?: IconPickerProps['initial']): Tab {
  if (!initial?.iconType) return 'favicon';
  if (initial.iconType === 'svg') return 'svg';
  if (initial.iconType === 'image') return 'image';
  return 'favicon';
}

/**
 * Tabbed icon picker — Favicon / Ikoner / Bilde, matching the legacy
 * `links.html` modal exactly. The Emoji tab from the legacy is gone —
 * Ikoner is now backed by `lucide-react` (~150 curated icons), with a
 * search input so the grid stays usable.
 */
export const IconPicker = forwardRef<IconPickerHandle, IconPickerProps>(function IconPicker(
  { initial, domainHint },
  ref
) {
  const [tab, setTab] = useState<Tab>(() => detectInitialTab(initial));

  // Per-tab selection state.
  const [selectedSvgId, setSelectedSvgId] = useState<string | null>(
    initial?.iconType === 'svg' ? initial.iconValue ?? null : null
  );

  // Image tab state
  const [imgOriginal, setImgOriginal] = useState<string | null>(
    initial?.iconType === 'image' ? initial.iconValue ?? null : null
  );
  const [imgDataUrl, setImgDataUrl] = useState<string | null>(
    initial?.iconType === 'image' ? initial.iconValue ?? null : null
  );
  const [imgBlend, setImgBlend] = useState(false);
  const [imgBlendInfo, setImgBlendInfo] = useState('');
  const [imgUrlInput, setImgUrlInput] = useState('');
  const [imgDragOver, setImgDragOver] = useState(false);

  // Favicon tab state
  const [faviconBg, setFaviconBg] = useState(false);
  const [faviconBgInfo, setFaviconBgInfo] = useState('');

  // SVG icon search filter
  const [svgSearch, setSvgSearch] = useState('');
  const filteredIcons = useMemo(() => {
    const q = svgSearch.trim().toLowerCase();
    if (!q) return SVG_ICONS;
    return SVG_ICONS.filter(
      (i) => i.id.toLowerCase().includes(q) || i.label.toLowerCase().includes(q)
    );
  }, [svgSearch]);

  const liveDomain = domainHint?.trim() ?? '';

  // ── Imperative resolve for save-time processing ──────────────────────
  useImperativeHandle(ref, () => ({
    async resolve(linkUrl: string): Promise<ResolvedIcon> {
      if (tab === 'svg' && selectedSvgId) {
        return { iconType: 'svg', iconValue: selectedSvgId };
      }
      if (tab === 'image' && imgDataUrl) {
        return { iconType: 'image', iconValue: imgDataUrl };
      }
      // Favicon tab — optionally bake the bg-removed version into a PNG.
      if (tab === 'favicon') {
        const domain = getDomain(linkUrl) || liveDomain;
        if (domain && faviconBg) {
          try {
            const dataUrl = await removeWhiteBg(faviconUrl(domain));
            return { iconType: 'image', iconValue: dataUrl };
          } catch {
            // Fall through to plain favicon if bg removal fails.
          }
        }
        return { iconType: 'favicon', iconValue: '' };
      }
      return { iconType: 'favicon', iconValue: '' };
    },
  }));

  // ── Image tab helpers ────────────────────────────────────────────────
  function applyImage(src: string) {
    setImgOriginal(src);
    setImgDataUrl(src);
    setImgBlendInfo('');
    if (imgBlend) processImageBlend(src);
  }

  function processImageBlend(src: string) {
    setImgBlendInfo('Behandler…');
    removeWhiteBg(src)
      .then((data) => {
        setImgDataUrl(data);
        setImgBlendInfo('Hvit bakgrunn fjernet ✓');
      })
      .catch((err: Error) => setImgBlendInfo(err.message));
  }

  function onImgBlendToggle(checked: boolean) {
    setImgBlend(checked);
    if (!checked) {
      if (imgOriginal) setImgDataUrl(imgOriginal);
      setImgBlendInfo('');
      return;
    }
    if (imgOriginal) processImageBlend(imgOriginal);
  }

  function imgClear() {
    setImgOriginal(null);
    setImgDataUrl(null);
    setImgUrlInput('');
    setImgBlendInfo('');
  }

  function imgFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => applyImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  function imgUrlApply() {
    if (imgUrlInput.trim()) applyImage(imgUrlInput.trim());
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setImgDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => applyImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  // ── Render ───────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div className="icon-picker-tabs">
        {(['favicon', 'svg', 'image'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={cn('icon-tab', tab === t && 'active')}
            onClick={() => setTab(t)}
          >
            {t === 'favicon' ? 'Favicon' : t === 'svg' ? 'Ikoner' : 'Bilde'}
          </button>
        ))}
      </div>

      {/* Favicon tab */}
      {tab === 'favicon' && (
        <div>
          <div className="favicon-preview">
            {liveDomain ? (
              <>
                <img
                  src={faviconUrl(liveDomain)}
                  alt=""
                  onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                />
                <span className="favicon-preview-text">{liveDomain}</span>
              </>
            ) : (
              <>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="rgba(255,255,255,0.15)">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93z" />
                </svg>
                <span className="favicon-preview-text">
                  Skriv inn en URL for å laste favicon automatisk
                </span>
              </>
            )}
          </div>
          <div className="img-blend-row">
            <input
              type="checkbox"
              id="favicon-bg-check"
              checked={faviconBg}
              onChange={(e) => {
                setFaviconBg(e.target.checked);
                setFaviconBgInfo(e.target.checked ? 'Behandles ved lagring' : '');
              }}
            />
            <label htmlFor="favicon-bg-check">Fjern hvit/lys bakgrunn</label>
          </div>
          <div className="img-blend-info">{faviconBgInfo}</div>
        </div>
      )}

      {/* SVG icons tab */}
      {tab === 'svg' && (
        <div>
          <input
            type="text"
            className="modal-input"
            placeholder={`Søk i ${SVG_ICONS.length} ikoner…`}
            value={svgSearch}
            onChange={(e) => setSvgSearch(e.target.value)}
            style={{ marginBottom: 10 }}
          />
          <div className="icon-grid">
            {filteredIcons.map((ic) => {
              const Icon = ic.Component;
              return (
                <button
                  key={ic.id}
                  type="button"
                  title={ic.label}
                  className={cn('icon-cell', selectedSvgId === ic.id && 'selected')}
                  onClick={() => setSelectedSvgId(ic.id)}
                >
                  <Icon size={18} strokeWidth={1.75} />
                </button>
              );
            })}
            {filteredIcons.length === 0 && (
              <div
                style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  padding: '20px 0',
                  fontSize: '0.78rem',
                  color: 'var(--color-text-muted)',
                }}
              >
                Ingen treff på "{svgSearch}"
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image tab */}
      {tab === 'image' && (
        <div>
          {imgDataUrl ? (
            <div className="img-preview-wrap">
              <img src={imgDataUrl} alt="" />
              <div className="img-preview-info">Bilde lastet</div>
              <button type="button" className="img-clear-btn" onClick={imgClear}>
                Fjern
              </button>
            </div>
          ) : (
            <>
              <div
                className={cn('img-drop-zone', imgDragOver && 'dragover')}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setImgDragOver(true);
                }}
                onDragLeave={() => setImgDragOver(false)}
                onDrop={onDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={imgFileSelected}
                />
                <div className="img-drop-zone-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.3 }}>
                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                  </svg>
                </div>
                <div className="img-drop-zone-text">
                  Slipp bilde her eller <span>velg fil</span>
                </div>
              </div>
              <div className="img-url-divider">eller lim inn URL</div>
              <div className="img-url-row">
                <input
                  type="url"
                  placeholder="https://example.com/icon.png"
                  value={imgUrlInput}
                  onChange={(e) => setImgUrlInput(e.target.value)}
                />
                <button type="button" className="img-url-btn" onClick={imgUrlApply}>
                  Bruk
                </button>
              </div>
            </>
          )}
          <div className="img-blend-row">
            <input
              type="checkbox"
              id="img-blend-check"
              checked={imgBlend}
              onChange={(e) => onImgBlendToggle(e.target.checked)}
            />
            <label htmlFor="img-blend-check">Fjern hvit/lys bakgrunn</label>
          </div>
          <div className="img-blend-info">{imgBlendInfo}</div>
        </div>
      )}
    </>
  );
});

function getDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
