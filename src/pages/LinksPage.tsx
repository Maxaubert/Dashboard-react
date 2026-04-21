import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useLinks, useSaveLinks } from '@/hooks/useLinks';
import { FAVORITES_CATEGORY_ID, OTHER_CATEGORY_ID } from '@/api/types';
import type { LinkItem } from '@/api/types';
import { Modal, useToast } from '@/components/ui';
import { IconPicker, type IconPickerHandle } from '@/components/patterns';
import { faviconUrl } from '@/api/pdf';
import { resolveSvgIcon } from '@/data/svgIcons';
import { LINK_COLOR_PRESETS } from '@/data/linkColors';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { cn } from '@/lib/cn';
import { groupLinks, type SectionRender } from '@/lib/groupLinks';
import { SectionHeader } from '@/components/links/SectionHeader';
import { CategoryPickerRow } from '@/components/links/CategoryPickerRow';
import { useCategories } from '@/hooks/useCategories';
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
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
  // Set by the outer right-click handler to the category id that was under
  // the cursor; seeded into the add-link modal so the popup opens with that
  // category pre-selected. Pseudo sections (Favorites/Other) → undefined.
  const pendingCategoryRef = useRef<string | undefined>(undefined);

  const derivedSections = useMemo(() => groupLinks(links, categories), [links, categories]);

  // Multi-container drag pattern (mirrors TodoPage): mirror sections into
  // local state and move items between sections during `onDragOver` so the
  // dragged card visually lives in the destination mid-drag instead of
  // snapping back to its source SortableContext.
  const [localSections, setLocalSections] = useState<SectionRender[]>(derivedSections);
  const [activeLinkId, setActiveLinkId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  // Re-seed local from upstream when props actually differ AND no drag is
  // in progress. Content-level compare prevents clobbering a just-committed
  // drop before the optimistic cache write has propagated.
  useEffect(() => {
    if (activeLinkId || activeSectionId) return;
    const keyOf = (sections: SectionRender[]) =>
      sections
        .map((s) =>
          [
            s.category.id,
            s.links.map((l) => `${l.id}#${l.favorite ? 1 : 0}#${l.category ?? '-'}`).join(','),
          ].join(':'),
        )
        .join('|');
    if (keyOf(derivedSections) === keyOf(localSections)) return;
    setLocalSections(derivedSections);
  }, [derivedSections, localSections, activeLinkId, activeSectionId]);

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

  /** Resolve which section an id belongs to, using local state.
   *  The section's grid droppable uses id `${categoryId}::grid`; strip
   *  any droppable suffix before matching. */
  function findLocalSection(id: string): SectionRender | undefined {
    const realId = id.replace(/::(empty|grid)$/, '');
    const asSection = localSections.find((s) => s.category.id === realId);
    if (asSection) return asSection;
    return localSections.find((s) => s.links.some((l) => l.id === realId));
  }

  function handleDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    if (localSections.some((s) => s.category.id === id)) {
      setActiveSectionId(id);
    } else {
      setActiveLinkId(id);
    }
  }

  function handleDragOver(e: DragOverEvent) {
    // Section drags don't need mid-drag container moves — they're handled
    // by the outer SortableContext purely via transforms.
    if (!activeLinkId) return;
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    const fromSection = localSections.find((s) => s.links.some((l) => l.id === activeId));
    const toSection = findLocalSection(overId);
    if (!fromSection || !toSection || fromSection.category.id === toSection.category.id) return;

    setLocalSections((prev) => {
      const next = prev.map((s) => ({ ...s, links: [...s.links] }));
      const from = next.find((s) => s.category.id === fromSection.category.id);
      const to = next.find((s) => s.category.id === toSection.category.id);
      if (!from || !to) return prev;
      const fromIdx = from.links.findIndex((l) => l.id === activeId);
      if (fromIdx < 0) return prev;
      const [moved] = from.links.splice(fromIdx, 1);
      // Insertion index: if hovering the section wrapper, append; otherwise
      // insert before the over-item so the placeholder appears at its slot.
      let insertIdx: number;
      if (overId === to.category.id) {
        insertIdx = to.links.length;
      } else {
        const idx = to.links.findIndex((l) => l.id === overId);
        insertIdx = idx < 0 ? to.links.length : idx;
      }
      to.links.splice(insertIdx, 0, moved);
      return next;
    });
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    const wasSectionDrag = activeSectionId !== null;
    const wasLinkDrag = activeLinkId !== null;
    setActiveSectionId(null);
    setActiveLinkId(null);

    const activeId = String(active.id);
    const overId = over ? String(over.id) : null;

    // Section reordering path — requires a valid over target.
    if (wasSectionDrag) {
      if (!over || activeId === overId) {
        setLocalSections(derivedSections);
        return;
      }
      const sectionIds = localSections.map((s) => s.category.id);
      const oldIndex = sectionIds.indexOf(activeId);
      const newIndex = sectionIds.indexOf(overId!);
      if (oldIndex < 0 || newIndex < 0) return;
      const nextOrder = arrayMove(sectionIds, oldIndex, newIndex);
      const visible = new Set(nextOrder);
      const hidden = categories
        .filter((c) => !visible.has(c.id))
        .sort((a, b) => a.order - b.order)
        .map((c) => c.id);
      reorderCategories([...nextOrder, ...hidden]);
      return;
    }

    if (!wasLinkDrag) return;

    // Stretched <a> inside each card would otherwise open the link when
    // the browser fires the synthetic click after pointerup. Swallow it.
    installOneShotClickSuppress();

    // Link drop: determine the final section + order from localSections
    // (already updated by onDragOver for cross-section moves), apply any
    // within-section reorder against the over target, then persist.
    // We DON'T revert when `over` is null — handleDragOver may have
    // already moved the link to the correct section, and a brief loss
    // of `over` at drop time (e.g. droppable size mid-render) shouldn't
    // discard that progress. If nothing actually moved (localSections
    // matches derivedSections), the persist below is a no-op write.
    const toSection = localSections.find((s) => s.links.some((l) => l.id === activeId));
    if (!toSection) {
      setLocalSections(derivedSections);
      return;
    }

    let finalSections = localSections;
    if (overId !== null && overId !== toSection.category.id) {
      const ids = toSection.links.map((l) => l.id);
      const fromIdx = ids.indexOf(activeId);
      const toIdx = ids.indexOf(overId);
      if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
        const reordered = arrayMove(toSection.links, fromIdx, toIdx);
        finalSections = localSections.map((s) =>
          s.category.id === toSection.category.id ? { ...s, links: reordered } : s,
        );
        setLocalSections(finalSections);
      }
    }

    // Rebuild the flat links array preserving both section membership and
    // within-section order. `groupLinks` buckets by input order, so the
    // persisted order must reflect what the user sees.
    const now = Date.now();
    const upstreamById = new Map(links.map((l) => [l.id, l]));
    const newLinks: LinkItem[] = [];
    for (const section of finalSections) {
      for (const link of section.links) {
        const upstream = upstreamById.get(link.id);
        if (!upstream) continue;
        const update: Partial<LinkItem> = {};
        if (section.kind === 'favorites') {
          update.favorite = true;
        } else if (section.kind === 'other') {
          update.favorite = false;
          update.category = undefined;
        } else {
          update.favorite = false;
          update.category = section.category.id;
        }
        const isMoved = link.id === activeId;
        newLinks.push({
          ...upstream,
          ...update,
          updatedAt: isMoved ? now : upstream.updatedAt,
        });
      }
    }

    persist(newLinks);
  }

  function handleDragCancel() {
    if (activeLinkId !== null) installOneShotClickSuppress();
    setActiveLinkId(null);
    setActiveSectionId(null);
    setLocalSections(derivedSections);
  }

  const activeLink =
    activeLinkId != null
      ? localSections.flatMap((s) => s.links).find((l) => l.id === activeLinkId) ?? null
      : null;

  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div
            className="links-library-root"
            onContextMenu={(e) => {
              const hit = (e.target as HTMLElement).closest('[data-category-id]');
              const id = hit?.getAttribute('data-category-id') ?? undefined;
              pendingCategoryRef.current =
                id && id !== FAVORITES_CATEGORY_ID && id !== OTHER_CATEGORY_ID
                  ? id
                  : undefined;
            }}
          >
            <div className="lenker-header">
              <div className="lenker-title-wrap">
                <div className="lenker-title">Lenkebibliotek</div>
                <div className="lenker-sub">Dine lagrede lenker</div>
              </div>
              <button
                className="btn-new-link"
                onClick={() => {
                  pendingCategoryRef.current = undefined;
                  setCreating(true);
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Ny lenke
              </button>
            </div>

            {localSections.length === 0 ? (
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
                collisionDetection={closestCorners}
                // Re-measure droppables on every render. Without this,
                // dnd-kit caches rects from mount time, so a section
                // whose grid grows or shrinks mid-drag (placeholder ↔
                // first item) keeps its stale size and the over-target
                // misses or misroutes.
                measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
                <SortableContext
                  items={localSections.map((s) => s.category.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {localSections.map((section) => (
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
                <DragOverlay>
                  {activeLink ? <LinkCardOverlay link={activeLink} /> : null}
                </DragOverlay>
              </DndContext>
            )}
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
              onSelect={() => setCreating(true)}
              style={{ padding: '6px 10px', color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.78rem', cursor: 'pointer', borderRadius: 4, outline: 'none' }}
            >
              Ny lenke
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      {(editing || creating) && (
        <LinkEditModal
          item={editing}
          defaultCategoryId={creating && !editing ? pendingCategoryRef.current : undefined}
          onClose={() => {
            setEditing(null);
            setCreating(false);
            pendingCategoryRef.current = undefined;
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
    // The dragged card is rendered in the DragOverlay; hide the source.
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="touch-none"
      {...attributes}
      {...listeners}
    >
      <LinkCard link={link} onEdit={onEdit} onDelete={onDelete} onToggleFavorite={onToggleFavorite} />
    </div>
  );
}

/** Always-mounted grid container that doubles as a useDroppable for the
 *  section. Keeping the droppable mounted across renders (instead of
 *  attaching it to the empty-state placeholder) prevents dnd-kit from
 *  losing the `over` target the instant a link is moved in mid-drag —
 *  which would otherwise hit the "dropped in no-mans-land → revert"
 *  path on dragEnd. The id uses a `::grid` suffix so it doesn't collide
 *  with the section's outer useSortable droppable; findLocalSection
 *  strips the suffix. */
function SectionGrid({
  sectionId,
  empty,
  children,
}: {
  sectionId: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${sectionId}::grid` });
  return (
    <div ref={setNodeRef} className="links-grid">
      {children}
      {empty && (
        <div className={cn('links-grid-droptarget', isOver && 'is-over')}>
          Slipp lenker her
        </div>
      )}
    </div>
  );
}

/** The dragged card shown in the DragOverlay portal during drag. */
function LinkCardOverlay({ link }: { link: LinkItem }) {
  return (
    <div style={{ cursor: 'grabbing' }}>
      <LinkCard
        link={link}
        onEdit={() => {}}
        onDelete={() => {}}
        onToggleFavorite={() => {}}
      />
    </div>
  );
}

/**
 * Install a one-shot `click` listener on document in capture phase that
 * swallows the next click event and auto-unregisters. A safety timeout
 * removes it after 120ms in case no click comes (e.g. drop missed any
 * droppable), so later clicks aren't affected.
 */
function installOneShotClickSuppress() {
  let done = false;
  function onClick(e: Event) {
    if (done) return;
    done = true;
    e.preventDefault();
    e.stopImmediatePropagation();
    document.removeEventListener('click', onClick, true);
  }
  document.addEventListener('click', onClick, true);
  window.setTimeout(() => {
    if (done) return;
    done = true;
    document.removeEventListener('click', onClick, true);
  }, 120);
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
    <div
      ref={setNodeRef}
      style={style}
      className="links-section"
      data-category-id={section.category.id}
      {...attributes}
    >
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
        <SectionGrid
          sectionId={section.category.id}
          empty={section.links.length === 0}
        >
          {section.links.map((link) => (
            <SortableLinkCard
              key={link.id}
              link={link}
              onEdit={() => onEdit(link)}
              onDelete={() => onDelete(link.id)}
              onToggleFavorite={() => onToggleFavorite(link.id)}
            />
          ))}
        </SectionGrid>
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
  defaultCategoryId?: string;
  onClose: () => void;
  onSave: (item: LinkItem) => void;
  onDelete?: () => void;
}

function LinkEditModal({ item, defaultCategoryId, onClose, onSave, onDelete }: LinkEditModalProps) {
  const [form, setForm] = useState<LinkItem>(
    item ?? {
      id: `link_${Date.now()}`,
      url: '',
      name: '',
      sub: '',
      color: LINK_COLOR_PRESETS[6], // legacy default purple
      favorite: false,
      category: defaultCategoryId,
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
