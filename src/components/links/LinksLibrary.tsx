import { useEffect, useMemo, useRef, useState } from 'react';
import { useLinks, useSaveLinks } from '@/hooks/useLinks';
import { FAVORITES_CATEGORY_ID, OTHER_CATEGORY_ID } from '@/api/types';
import type { LinkItem } from '@/api/types';
import { useToast } from '@/components/ui';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { groupLinks, type SectionRender } from '@/lib/groupLinks';
import { useCategories } from '@/hooks/useCategories';
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  KeyboardSensor,
  PointerSensor,
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
  arrayMove,
} from '@dnd-kit/sortable';
import { LinkCardOverlay } from '@/components/links/LinkCard';
import { SortableSection } from '@/components/links/SortableSection';
import { LinkEditModal } from '@/components/links/LinkEditModal';
import { pointerOrCorners, installOneShotClickSuppress } from '@/lib/linkUtils';

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
                // pointerWithin first: an empty drop zone the cursor is
                // literally on top of beats anything else by intent.
                // Fall back to closestCorners for the in-between gaps
                // between cards so reordering still feels right.
                collisionDetection={pointerOrCorners}
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
