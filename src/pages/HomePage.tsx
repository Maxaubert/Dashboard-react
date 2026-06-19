import { useMemo } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { PageHeader } from '@/components/layout/PageHeader';
import { HomeAccount } from '@/components/home/HomeAccount';
import { useHome, useMutateHome } from '@/hooks/useHome';
import { useHomeMigration } from '@/hooks/useHomeMigration';
import { SECTION_IDS, DEFAULT_SECTIONS, type SectionId } from '@/lib/home';
import { SortableHomeSection } from '@/components/home/SortableHomeSection';

/**
 * Home page — faithful port of the legacy index.html.
 *
 * Sections (in order):
 *   1. Kategorier — 4 category cards (Plan, Notater, Sport, Gaming)
 *   2. Eksterne lenker — favourites carousel with "Alle" link to /links
 *   3. Dagens plan — today's events from /api/plan
 *   4. Nyhetssaker — VG news cards from /api/news
 */
export function HomePage() {
  useHomeMigration();

  // Persist the section order so the user's preference survives reloads.
  // Validate against SECTION_IDS so a stale order from an older schema
  // doesn't drop or duplicate sections.
  const { data: home } = useHome();
  const mutateHome = useMutateHome();
  const storedOrder: SectionId[] = (home?.sections?.length ? home.sections : DEFAULT_SECTIONS) as SectionId[];
  function setStoredOrder(next: SectionId[]) {
    mutateHome((prev) => ({ ...prev, sections: next }));
  }
  const order = useMemo<SectionId[]>(() => {
    const known = (storedOrder ?? []).filter((id): id is SectionId =>
      (SECTION_IDS as readonly string[]).includes(id)
    );
    const missing = SECTION_IDS.filter((id) => !known.includes(id));
    return [...known, ...missing];
  }, [storedOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = order.indexOf(active.id as SectionId);
    const newIdx = order.indexOf(over.id as SectionId);
    if (oldIdx < 0 || newIdx < 0) return;
    setStoredOrder(arrayMove(order, oldIdx, newIdx));
  }

  return (
    <div className="page">
      <div className="home-topbar">
        <PageHeader eyebrow="Hjem" title="Dashboard" subtitle="Velg en kategori" />
        <HomeAccount />
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="sections-container">
            {order.map((id) => (
              <SortableHomeSection key={id} id={id} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
