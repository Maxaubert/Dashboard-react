import { type CSSProperties } from 'react';
import type { LinkItem } from '@/api/types';
import { faviconUrl } from '@/api/pdf';
import { resolveSvgIcon } from '@/data/svgIcons';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { cn } from '@/lib/cn';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getDomain } from '@/lib/linkUtils';

/* ── Link card ───────────────────────────────────────────────────────────── */
export interface LinkCardProps {
  link: LinkItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}

export function LinkCard({ link, onEdit, onDelete, onToggleFavorite }: LinkCardProps) {
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

/* ── Sortable link card ──────────────────────────────────────────────────── */
export function SortableLinkCard({
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

/** The dragged card shown in the DragOverlay portal during drag. */
export function LinkCardOverlay({ link }: { link: LinkItem }) {
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
