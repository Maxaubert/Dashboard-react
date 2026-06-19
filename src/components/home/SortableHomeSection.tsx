import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/cn';
import type { SectionId } from '@/lib/home';
import { type HandleProps } from '@/components/home/GripHandle';
import { WishlistSection } from '@/components/home/SectionWishlist';
import { EksterneLenkerSection } from '@/components/home/SectionEksterneLenker';
import { DagensPlanSection } from '@/components/home/SectionDagensPlan';
import { VaerSection } from '@/components/home/SectionVaer';
import { NyhetssakerSection } from '@/components/home/SectionNyhetssaker';
import { PromptLauncher } from '@/components/launcher/PromptLauncher';
import { TodoSection } from '@/components/home/SectionTodo';

/**
 * Wraps a single home section in a dnd-kit sortable container. Renders
 * the appropriate section component based on `id` and threads the drag
 * handle props down so the grip icon (and ONLY the grip icon) initiates
 * the drag — clicking anywhere else in the section still works normally.
 */
export function SortableHomeSection({ id }: { id: SectionId }) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({
    id,
  });
  // CSS.Translate (not CSS.Transform) so the ghost only translates and
  // doesn't pick up dnd-kit's scaleY when hovering over a section of a
  // different height — that scaling is what made sections visually morph
  // mid-drag.
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };
  const handleProps: HandleProps = { ...attributes, ...(listeners ?? {}) };

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && 'db-section-dragging')}>
      {id === 'prompt-launcher' && <PromptLauncher handleProps={handleProps} />}
      {id === 'todo' && <TodoSection handleProps={handleProps} />}
      {id === 'wishlist' && <WishlistSection handleProps={handleProps} />}
      {id === 'ext-lenker' && <EksterneLenkerSection handleProps={handleProps} />}
      {id === 'dagens-plan' && <DagensPlanSection handleProps={handleProps} />}
      {id === 'vaer' && <VaerSection handleProps={handleProps} />}
      {id === 'nyhetssaker' && <NyhetssakerSection handleProps={handleProps} />}
    </div>
  );
}
