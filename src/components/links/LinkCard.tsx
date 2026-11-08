import {
  type CSSProperties,
  type KeyboardEventHandler,
  type MouseEvent,
  type PointerEventHandler,
} from 'react';
import type { LinkItem } from '@/api/types';
import { cn } from '@/lib/cn';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LinkIconRender } from './LinkIconRender';

/* ── Link card ───────────────────────────────────────────────────────────── */
interface LinkCardProps {
  link: LinkItem;
  onToggleFavorite: () => void;
  /** Right-click handler - opens the Edit/Remove menu owned by LinksLibrary.
   *  Omitted for the drag overlay clone, which has no menu. */
  onContextMenu?: (e: MouseEvent) => void;
}

function LinkCard({ link, onToggleFavorite, onContextMenu }: LinkCardProps) {
  const accent = link.color ?? '#e8214e';

  return (
    <div
      className="ext-link"
      style={{ ['--ext-color' as string]: accent }}
      onContextMenu={onContextMenu}
    >
      <a
        href={link.url}
        target="_blank"
        rel="noreferrer noopener"
        className="ext-link-stretched"
        aria-label={link.name}
      />

      <div className="ext-link-top">
        <div className="ext-link-icon-wrap">
          <LinkIconRender link={link} />
        </div>
        <svg className="ext-link-arrow" width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 3l-1.41 1.41L18.17 10H4v2h14.17l-5.58 5.59L14 19l8-8z" />
        </svg>
      </div>

      <div className="card-bottom">
        <div className="card-bottom-text">
          <div className="ext-link-name">{link.name}</div>
          {link.sub && <div className="ext-link-sub">{link.sub}</div>}
        </div>
        <button
          type="button"
          className={cn('fav-btn', link.favorite && 'favorited')}
          aria-label={link.favorite ? 'Fjern favoritt' : 'Marker som favoritt'}
          aria-pressed={link.favorite === true}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
        >
          ★
        </button>
      </div>
    </div>
  );
}

/* ── Sortable link card ──────────────────────────────────────────────────── */
export function SortableLinkCard({
  link, dragId, onToggleFavorite, onContextMenu,
}: {
  link: LinkItem;
  dragId: string;
  onToggleFavorite: () => void;
  onContextMenu: (e: MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: dragId });

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
      onPointerDown={listeners?.onPointerDown as PointerEventHandler<HTMLDivElement> | undefined}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget) {
          (listeners?.onKeyDown as KeyboardEventHandler<HTMLDivElement> | undefined)?.(e);
        }
      }}
    >
      <LinkCard link={link} onToggleFavorite={onToggleFavorite} onContextMenu={onContextMenu} />
    </div>
  );
}

/** The dragged card shown in the DragOverlay portal during drag. */
export function LinkCardOverlay({ link }: { link: LinkItem }) {
  return (
    <div style={{ cursor: 'grabbing' }}>
      <LinkCard link={link} onToggleFavorite={() => {}} />
    </div>
  );
}
