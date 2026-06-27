import type { ComponentType } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { usePageOverlay, type OverlayKey } from '@/context/PageOverlayContext';
import { PlanPage } from '@/pages/PlanPage';
import { TodoPage } from '@/pages/TodoPage';
import { GamingPage } from '@/pages/GamingPage';
import { LinksPage } from '@/pages/LinksPage';
import '@/styles/overlay-dark.css';

const PAGES: Record<OverlayKey, ComponentType> = {
  plan: PlanPage,
  todo: TodoPage,
  gaming: GamingPage,
  links: LinksPage,
};

export function PageOverlay() {
  const { key, closeOverlay } = usePageOverlay();
  if (!key) return null;
  const Page = PAGES[key];
  return (
    <Dialog.Root open onOpenChange={(o) => !o && closeOverlay()}>
      <Dialog.Portal>
        <Dialog.Overlay className="page-overlay-backdrop" />
        <Dialog.Content className="page-overlay-panel" aria-label="Side">
          <Dialog.Close asChild>
            <button className="page-overlay-close" aria-label="Lukk">✕</button>
          </Dialog.Close>
          <div className="page-overlay-scroll">
            <Page />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
