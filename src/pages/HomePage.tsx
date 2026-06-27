import { useMemo, useState } from 'react';
import { Settings } from 'lucide-react';
import { HomeAccount } from '@/components/home/HomeAccount';
import { SettingsModal } from '@/components/home/SettingsModal';
import { HomeBento } from '@/components/home-bento/HomeBento';
import { useHome, useMutateHome } from '@/hooks/useHome';
import { useHomeMigration } from '@/hooks/useHomeMigration';
import { SECTION_IDS, DEFAULT_SECTIONS, type SectionId } from '@/lib/home';

/**
 * Home page — dark "bento grid" dashboard.
 *
 * The grid itself lives in `HomeBento`. This shell keeps the cross-cutting
 * bits: the one-shot localStorage→backend migration, the Settings modal
 * (section show/hide + reorder), and the account controls. The Settings
 * button + account render into the bento top bar via `topActions`.
 *
 * Section reordering still persists, but the bento uses a fixed layout, so
 * order only affects the Settings list; visibility (`hidden`) is honoured
 * by the bento.
 */
export function HomePage() {
  useHomeMigration();

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
      (SECTION_IDS as readonly string[]).includes(id),
    );
    const missing = SECTION_IDS.filter((id) => !known.includes(id));
    return [...known, ...missing];
  }, [storedOrder]);

  return (
    <>
      <HomeBento
        topActions={
          <>
            <button
              type="button"
              className="bento-settings-btn"
              aria-label="Innstillinger"
              title="Innstillinger"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings size={18} />
            </button>
            <HomeAccount />
          </>
        }
      />
      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        order={order}
        hidden={hidden}
        onToggle={toggleSection}
        onReorder={setStoredOrder}
      />
    </>
  );
}
