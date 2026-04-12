import { useMemo, useRef, useState } from 'react';
import { useLinks, useSaveLinks } from '@/hooks/useLinks';
import type { LinkItem } from '@/api/types';
import { Modal, useToast } from '@/components/ui';
import { IconPicker, type IconPickerHandle, SortableList } from '@/components/patterns';
import { faviconUrl } from '@/api/pdf';
import { resolveSvgIcon } from '@/data/svgIcons';
import { LINK_COLOR_PRESETS } from '@/data/linkColors';
import { cn } from '@/lib/cn';
import { groupLinks } from '@/lib/groupLinks';
import { SectionHeader } from '@/components/links/SectionHeader';
import { CategoryPickerRow } from '@/components/links/CategoryPickerRow';
import { useCategories } from '@/hooks/useCategories';

/**
 * Lenker page — faithful port of links.html.
 *
 * Layout:
 *   .page-inner > .lenker-header (small two-line title + Ny lenke button)
 *               > .links-grid (drag-sortable cards, 148px min)
 *
 * Card has hover-only edit/delete buttons (top-right) and a star
 * favorite toggle in the bottom row. Modal uses the `standard` variant
 * (header X close + right-aligned footer + 4-tab icon picker).
 *
 * The body is extracted into <LinksLibrary /> so it can also be rendered
 * inside a popup from the sidebar — same look, same data, same edit flow.
 */
export function LinksPage() {
  return (
    <div className="page-inner">
      <LinksLibrary />
    </div>
  );
}

/**
 * Reusable library body — used both as a full page (LinksPage) and
 * inside the sidebar popup (LinksLibraryPopup). Owns all state so
 * callers don't need to thread edit/create props through.
 */
export function LinksLibrary() {
  const { data } = useLinks();
  const saveLinks = useSaveLinks();
  const { toast } = useToast();

  const envelope = data ?? { version: 2 as const, links: [], categories: [] };
  const { links, categories } = envelope;

  const [editing, setEditing] = useState<LinkItem | null>(null);
  const [creating, setCreating] = useState(false);

  const sections = useMemo(() => groupLinks(links, categories), [links, categories]);

  function persist(nextLinks: LinkItem[]) {
    saveLinks.mutate(
      { ...envelope, links: nextLinks },
      { onError: () => toast({ tone: 'danger', title: 'Klarte ikke å lagre' }) },
    );
  }

  function handleSave(item: LinkItem) {
    const idx = links.findIndex((l) => l.id === item.id);
    let next: LinkItem[];
    if (idx >= 0) {
      next = [...links];
      next[idx] = { ...item, updatedAt: Date.now() };
    } else {
      next = [...links, { ...item, createdAt: Date.now(), updatedAt: Date.now() }];
    }
    persist(next);
    setEditing(null);
    setCreating(false);
  }

  function handleDelete(id: string) {
    persist(links.filter((l) => l.id !== id));
    setEditing(null);
  }

  function toggleFavorite(id: string) {
    persist(links.map((l) => (l.id === id ? { ...l, favorite: !l.favorite } : l)));
  }

  function handleReorderWithinSection(nextSectionLinks: LinkItem[], sectionKind: 'favorites' | 'user' | 'other', categoryId?: string) {
    const keep = links.filter((l) => {
      if (sectionKind === 'favorites') return l.favorite !== true;
      if (sectionKind === 'other') return l.favorite === true || (l.category !== undefined && categories.some((c) => c.id === l.category));
      return l.favorite === true || l.category !== categoryId;
    });
    persist([...keep, ...nextSectionLinks]);
  }

  return (
    <>
      <div className="lenker-header">
        <div className="lenker-title-wrap">
          <div className="lenker-title">Lenkebibliotek</div>
          <div className="lenker-sub">Dine lagrede lenker</div>
        </div>
        <button className="btn-new-link" onClick={() => setCreating(true)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Ny lenke
        </button>
      </div>

      {sections.length === 0 ? (
        <div className="links-grid">
          <div className="links-empty">
            Ingen lenker ennå.
            <br />
            Klikk «Ny lenke» for å legge til den første.
          </div>
        </div>
      ) : (
        sections.map((section) => (
          <div key={section.category.id} className="links-section">
            <SectionHeader
              title={section.kind === 'favorites' ? '★ Favorites' : section.category.name}
              count={section.links.length}
            />
            <SortableList
              items={section.links}
              onReorder={(next) =>
                handleReorderWithinSection(
                  next,
                  section.kind,
                  section.kind === 'user' ? section.category.id : undefined,
                )
              }
              layout="grid"
              className="links-grid"
              renderItem={(link) => (
                <LinkCard
                  link={link}
                  onEdit={() => setEditing(link)}
                  onDelete={() => handleDelete(link.id)}
                  onToggleFavorite={() => toggleFavorite(link.id)}
                />
              )}
            />
          </div>
        ))
      )}

      {(editing || creating) && (
        <LinkEditModal
          item={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={handleSave}
          onDelete={editing ? () => handleDelete(editing.id) : undefined}
        />
      )}
    </>
  );
}

/* ── Link card ───────────────────────────────────────────────────────────── */
interface LinkCardProps {
  link: LinkItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}

function LinkCard({ link, onEdit, onDelete, onToggleFavorite }: LinkCardProps) {
  const accent = link.color ?? '#a78bfa';

  return (
    <div className="ext-link" style={{ ['--ext-color' as string]: accent }}>
      {/* Stretched anchor — fills the whole card so the entire surface
       * is clickable, not just the icon/text patches. The interactive
       * inner elements (edit / delete / favorite buttons) sit above it
       * via z-index in the CSS. */}
      <a
        href={link.url}
        target="_blank"
        rel="noreferrer noopener"
        className="ext-link-stretched"
        aria-label={link.name}
      />

      {/* Hover-only edit/delete buttons */}
      <div className="card-actions">
        <button
          type="button"
          className="card-btn"
          aria-label="Rediger"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </button>
        <button
          type="button"
          className="card-btn del"
          aria-label="Slett"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Slette «${link.name}»?`)) onDelete();
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      </div>

      {/* Top: icon + arrow (visual only — clicks pass through to the
       * stretched anchor above) */}
      <div className="ext-link-top">
        <div className="ext-link-icon-wrap">
          <LinkIconRender link={link} />
        </div>
        <svg className="ext-link-arrow" width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 3l-1.41 1.41L18.17 10H4v2h14.17l-5.58 5.59L14 19l8-8z" />
        </svg>
      </div>

      {/* Bottom: text + favorite star */}
      <div className="card-bottom">
        <div className="card-bottom-text">
          <div className="ext-link-name">{link.name}</div>
          {link.sub && <div className="ext-link-sub">{link.sub}</div>}
        </div>
        <button
          type="button"
          className={cn('fav-btn', link.favorite && 'favorited')}
          aria-label={link.favorite ? 'Fjern favoritt' : 'Marker som favoritt'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
        >
          ★
        </button>
      </div>
    </div>
  );
}

/* ── Icon renderer (used by both Lenker grid and Hjem favorites) ─────── */
export function LinkIconRender({ link }: { link: LinkItem }) {
  if (link.iconType === 'svg' && link.iconValue) {
    const ic = resolveSvgIcon(link.iconValue);
    if (ic) {
      const Icon = ic.Component;
      return <Icon size={26} strokeWidth={1.75} />;
    }
  }
  // Legacy `emoji` icons — render the character so old data still displays.
  if (link.iconType === 'emoji' && link.iconValue) {
    return <span className="emoji-icon" style={{ fontSize: 26, lineHeight: 1 }}>{link.iconValue}</span>;
  }
  if (link.iconType === 'image' && link.iconValue) {
    return <img src={link.iconValue} alt="" width={26} height={26} />;
  }
  // favicon (default) — derive domain from URL
  const domain = getDomain(link.url);
  if (!domain) return null;
  return <img src={faviconUrl(domain)} alt="" width={26} height={26} />;
}

function getDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/* ── Edit modal ──────────────────────────────────────────────────────────── */
interface LinkEditModalProps {
  item: LinkItem | null;
  onClose: () => void;
  onSave: (item: LinkItem) => void;
  onDelete?: () => void;
}

function LinkEditModal({ item, onClose, onSave, onDelete }: LinkEditModalProps) {
  const [form, setForm] = useState<LinkItem>(
    item ?? {
      id: `link_${Date.now()}`,
      url: '',
      name: '',
      sub: '',
      color: LINK_COLOR_PRESETS[6], // legacy default purple
      favorite: false,
    }
  );
  const pickerRef = useRef<IconPickerHandle>(null);
  const { categories, create: createCategory } = useCategories();
  const { data: envelope } = useLinks();
  const allLinks = envelope?.links ?? [];

  function update<K extends keyof LinkItem>(key: K, value: LinkItem[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (!form.url.trim() || !form.name.trim()) return;
    const icon = pickerRef.current
      ? await pickerRef.current.resolve(form.url)
      : { iconType: 'favicon' as const, iconValue: '' };
    onSave({ ...form, iconType: icon.iconType, iconValue: icon.iconValue });
  }

  const liveDomain = (() => {
    try {
      return new URL(form.url).hostname;
    } catch {
      return '';
    }
  })();

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={item ? 'Rediger lenke' : 'Ny lenke'}
      size="lg"
      variant="standard"
      footer={
        <>
          {onDelete && (
            <button className="btn-delete-std" onClick={onDelete}>
              Slett
            </button>
          )}
          <button className="btn-cancel-std" onClick={onClose}>
            Avbryt
          </button>
          <button className="btn-save-std" onClick={handleSubmit}>
            Lagre
          </button>
        </>
      }
    >
      {/* URL */}
      <div className="modal-row">
        <label htmlFor="f-url">URL</label>
        <input
          id="f-url"
          type="url"
          placeholder="https://…"
          value={form.url}
          onChange={(e) => update('url', e.target.value)}
        />
      </div>

      {/* Name + sub */}
      <div className="modal-row-2col">
        <div>
          <label htmlFor="f-name">Navn</label>
          <input
            id="f-name"
            type="text"
            placeholder="YouTube"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="f-sub">Undertekst</label>
          <input
            id="f-sub"
            type="text"
            placeholder="Video"
            value={form.sub ?? ''}
            onChange={(e) => update('sub', e.target.value)}
          />
        </div>
      </div>

      {/* Color */}
      <div className="modal-row">
        <label>Farge</label>
        <div className="ext-color-row">
          {LINK_COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => update('color', c)}
              style={{ background: c }}
              className={cn('ext-color-swatch', form.color === c && 'selected')}
              aria-label={`Velg farge ${c}`}
            />
          ))}
          <div className="color-custom-wrap" title="Egendefinert farge">
            <div className="color-custom-btn" />
            <input
              type="color"
              value={form.color ?? '#a78bfa'}
              onChange={(e) => update('color', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Category */}
      <div className="modal-row">
        <label>Kategori</label>
        <CategoryPickerRow
          categories={categories}
          links={allLinks}
          value={form.category}
          onChange={(next) => update('category', next)}
          onCreate={createCategory}
        />
      </div>

      {/* Icon picker */}
      <div className="modal-row">
        <label>Ikon</label>
        <IconPicker
          ref={pickerRef}
          initial={{ iconType: form.iconType, iconValue: form.iconValue }}
          domainHint={liveDomain}
        />
      </div>
    </Modal>
  );
}
