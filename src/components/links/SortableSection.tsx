import type { LinkItem } from '@/api/types';
import { cn } from '@/lib/cn';
import { groupLinks } from '@/lib/groupLinks';
import { SectionHeader } from '@/components/links/SectionHeader';
import { SortableLinkCard } from '@/components/links/LinkCard';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

/** Always-mounted grid container that doubles as a useDroppable for the
 *  section. Keeping the droppable mounted across renders (instead of
 *  attaching it to the empty-state placeholder) prevents dnd-kit from
 *  losing the `over` target the instant a link is moved in mid-drag —
 *  which would otherwise hit the "dropped in no-mans-land → revert"
 *  path on dragEnd. The id uses a `::grid` suffix so it doesn't collide
 *  with the section's outer useSortable droppable; findLocalSection
 *  strips the suffix. */
export function SectionGrid({
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

/* ── Sortable section wrapper ────────────────────────────────────────────── */
export function SortableSection({
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
