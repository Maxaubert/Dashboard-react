import { useMemo, useState } from 'react';
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
import { Settings } from 'lucide-react';
import { HomeAccount } from '@/components/home/HomeAccount';
import { SettingsModal } from '@/components/home/SettingsModal';
import { useHome, useMutateHome } from '@/hooks/useHome';
import { useHomeMigration } from '@/hooks/useHomeMigration';
import { SECTION_IDS, DEFAULT_SECTIONS, type SectionId } from '@/lib/home';
import { SortableHomeSection } from '@/components/home/SortableHomeSection';
import { SideGlyphs } from '@/components/home/SideGlyphs';

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const hidden = (home?.hidden ?? []) as SectionId[];

  function toggleSection(id: SectionId) {
    mutateHome((prev) => {
      const cur = (prev.hidden ?? []) as SectionId[];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return { ...prev, hidden: next };
    });
  }

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

  const visible = useMemo<SectionId[]>(
    () => order.filter((id) => !hidden.includes(id)),
    [order, hidden],
  );

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
      <SideGlyphs />
      <div className="home-topbar home-topbar--bare">
        <div className="home-topbar-actions">
          <button
            type="button"
            className="home-settings-btn"
            aria-label="Innstillinger"
            title="Innstillinger"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={18} />
          </button>
          <HomeAccount />
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={visible} strategy={verticalListSortingStrategy}>
          <div className="sections-container">
            {visible.length === 0 ? (
              <div className="home-empty-hint">
                Alle seksjoner er skjult – åpne Innstillinger for å vise dem.
              </div>
            ) : (
              visible.map((id) => <SortableHomeSection key={id} id={id} />)
            )}
          </div>
        </SortableContext>
      </DndContext>
      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        order={order}
        hidden={hidden}
        onToggle={toggleSection}
        onReorder={setStoredOrder}
      />
    </div>
  );
}
