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

/** Screen-reader name for each overlay; Radix requires a Dialog.Title. */
const LABELS: Record<OverlayKey, string> = {
  plan: 'Plan',
  todo: 'Todo',
  gaming: 'Gaming',
  links: 'Lenker',
};

export function PageOverlay() {
  const { key, closeOverlay } = usePageOverlay();
  if (!key) return null;
  const Page = PAGES[key];
  const label = LABELS[key];
  return (
    <Dialog.Root open onOpenChange={(o) => !o && closeOverlay()}>
      <Dialog.Portal>
        <Dialog.Overlay className="page-overlay-backdrop" />
        <Dialog.Content className="page-overlay-panel">
          <Dialog.Title className="sr-only">{label}</Dialog.Title>
          <Dialog.Description className="sr-only">{`Siden ${label} i fullskjerm`}</Dialog.Description>
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
