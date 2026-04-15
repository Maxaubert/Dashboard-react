import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useLinks, useSaveLinks } from '@/hooks/useLinks';
import { OTHER_CATEGORY_ID } from '@/api/types';
import type { LinkItem } from '@/api/types';
import { Modal, useToast } from '@/components/ui';
import { IconPicker, type IconPickerHandle } from '@/components/patterns';
import { faviconUrl } from '@/api/pdf';
import { resolveSvgIcon } from '@/data/svgIcons';
import { LINK_COLOR_PRESETS } from '@/data/linkColors';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { cn } from '@/lib/cn';
import { groupLinks } from '@/lib/groupLinks';
import { SectionHeader } from '@/components/links/SectionHeader';
import { CategoryPickerRow } from '@/components/links/CategoryPickerRow';
import { useCategories } from '@/hooks/useCategories';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

  const { reorder: reorderCategories, rename: renameCategory, remove: removeCategory } = useCategories();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e: DragEndEvent) => {
            const { active, over } = e;
            if (!over || active.id === over.id) return;

            const activeId = String(active.id);
            const overId = String(over.id);

            const sectionIds = sections.map((s) => s.category.id);
            const activeIsSection = sectionIds.includes(activeId);
            const overIsSection = sectionIds.includes(overId);

            if (activeIsSection && overIsSection) {
              const oldIndex = sectionIds.indexOf(activeId);
              const newIndex = sectionIds.indexOf(overId);
              const nextOrder = arrayMove(sectionIds, oldIndex, newIndex);
              const visible = new Set(nextOrder);
              const hidden = categories.filter((c) => !visible.has(c.id)).sort((a, b) => a.order - b.order).map((c) => c.id);
              reorderCategories([...nextOrder, ...hidden]);
              return;
            }

            const findSection = (linkId: string) => sections.find((s) => s.links.some((l) => l.id === linkId));
            const sourceSection = findSection(activeId);
            if (!sourceSection) return;

            let targetSection = findSection(overId);
            if (!targetSection && overIsSection) {
              targetSection = sections.find((s) => s.category.id === overId);
            }
            if (!targetSection) return;

            if (sourceSection === targetSection) {
              const ids = targetSection.links.map((l) => l.id);
              const oldIndex = ids.indexOf(activeId);
              const newIndex = ids.indexOf(overId);
              if (oldIndex < 0 || newIndex < 0) return;
              const reordered = arrayMove(targetSection.links, oldIndex, newIndex);
              const keep = links.filter((l) => {
                if (targetSection!.kind === 'favorites') return l.favorite !== true;
                if (targetSection!.kind === 'other') {
                  return l.favorite === true || (l.category !== undefined && categories.some((c) => c.id === l.category && c.id !== OTHER_CATEGORY_ID));
                }
                return l.favorite === true || l.category !== targetSection!.category.id;
              });
              persist([...keep, ...reordered]);
              return;
            }

            const movedLink = links.find((l) => l.id === activeId);
            if (!movedLink) return;
            const nextLinkPartial: Partial<LinkItem> = {};
            if (targetSection.kind === 'favorites') {
              nextLinkPartial.favorite = true;
            } else if (targetSection.kind === 'other') {
              nextLinkPartial.category = undefined;
              nextLinkPartial.favorite = false;
            } else {
              nextLinkPartial.category = targetSection.category.id;
              nextLinkPartial.favorite = false;
            }
            const nextLinks = links.map((l) =>
              l.id === activeId ? { ...l, ...nextLinkPartial, updatedAt: Date.now() } : l,
            );
            persist(nextLinks);
          }}
        >
          <SortableContext
            items={sections.map((s) => s.category.id)}
            strategy={verticalListSortingStrategy}
          >
            {sections.map((section) => (
              <SortableSection
                key={section.category.id}
                section={section}
                readonly={section.kind !== 'user'}
                onRename={(next) => renameCategory(section.category.id, next)}
                onDeleteSection={() => {
                  if (
                    confirm(
                      section.links.length === 0
                        ? `Slett kategorien «${section.category.name}»?`
                        : `Slett «${section.category.name}»? ${section.links.length} lenker flyttes til Other.`,
                    )
                  ) {
                    removeCategory(section.category.id);
                  }
                }}
                onEdit={(l) => setEditing(l)}
                onDelete={handleDelete}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </SortableContext>
        </DndContext>
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

/* ── Sortable link card ──────────────────────────────────────────────────── */
function SortableLinkCard({
  link, onEdit, onDelete, onToggleFavorite,
}: {
  link: LinkItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: link.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  // When a drag finishes, the browser fires a synthetic click on the
  // stretched anchor which opens the link. Catch that by watching
  // pointerup: if the drag was still active at that instant, mark the
  // very next click as to-be-suppressed. We mirror `isDragging` into a
  // ref each render so the pointerup handler sees the current value
  // (useEffect fires too late — after the click has already opened
  // the link).
  const isDraggingRef = useRef(isDragging);
  isDraggingRef.current = isDragging;
  const suppressClickRef = useRef(false);

  function handlePointerUpCapture() {
    if (isDraggingRef.current) {
      suppressClickRef.current = true;
      // Clear on the next macrotask — the click fires in the same task as
      // pointerup, so setTimeout 0 clears it after the offending click is
      // swallowed without blocking any later legitimate click.
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
  }

  function handleClickCapture(e: React.MouseEvent) {
    if (suppressClickRef.current || isDraggingRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="touch-none"
      onPointerUpCapture={handlePointerUpCapture}
      onClickCapture={handleClickCapture}
      {...attributes}
      {...listeners}
    >
      <LinkCard link={link} onEdit={onEdit} onDelete={onDelete} onToggleFavorite={onToggleFavorite} />
    </div>
  );
}

/* ── Sortable section wrapper ────────────────────────────────────────────── */
function SortableSection({
  section,
  readonly,
  onEdit,
  onDelete,
  onDeleteSection,
  onRename,
  onToggleFavorite,
}: {
  section: ReturnType<typeof groupLinks>[number];
  readonly: boolean;
  onEdit: (link: LinkItem) => void;
  onDelete: (id: string) => void;
  onDeleteSection: () => void;
  onRename: (next: string) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="links-section" {...attributes}>
      <SectionHeader
        title={section.kind === 'favorites' ? '★ Favorites' : section.category.name}
        count={section.links.length}
        readonly={readonly}
        onRename={onRename}
        onDelete={onDeleteSection}
        gripListeners={listeners as React.HTMLAttributes<HTMLElement>}
        dragging={isDragging}
      />
      <SortableContext items={section.links.map((l) => l.id)} strategy={rectSortingStrategy}>
        <div className="links-grid">
          {section.links.map((link) => (
            <SortableLinkCard
              key={link.id}
              link={link}
              onEdit={() => onEdit(link)}
              onDelete={() => onDelete(link.id)}
              onToggleFavorite={() => onToggleFavorite(link.id)}
            />
          ))}
        </div>
      </SortableContext>
    </div>
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
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div className="ext-link" style={{ ['--ext-color' as string]: accent }}>
          {/* Stretched anchor — fills the whole card so the entire surface
           * is clickable, not just the icon/text patches. The favorite
           * button sits above it via z-index in the CSS. Edit/Delete are
           * now on the right-click context menu (Radix) — matches the
           * widget pattern on the home page. */}
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer noopener"
            className="ext-link-stretched"
            aria-label={link.name}
          />

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
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          style={{
            background: '#0a0a0a',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 8,
            padding: 4,
            minWidth: 140,
            zIndex: 50,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
          }}
        >
          <ContextMenu.Item
            onSelect={onEdit}
            style={{ padding: '6px 10px', color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.78rem', cursor: 'pointer', borderRadius: 4, outline: 'none' }}
          >
            Edit
          </ContextMenu.Item>
          <ContextMenu.Item
            onSelect={() => {
              if (confirm(`Slette «${link.name}»?`)) onDelete();
            }}
            style={{ padding: '6px 10px', color: '#ef4444', fontSize: '0.78rem', cursor: 'pointer', borderRadius: 4, outline: 'none' }}
          >
            Remove
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
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
