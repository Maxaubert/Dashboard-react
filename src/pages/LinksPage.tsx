import { LinksLibrary } from '@/components/links/LinksLibrary';

/**
 * Lenker page — faithful port of links.html.
 *
 * Layout:
 *   .page-inner > .lenker-header (small two-line title + Ny lenke button)
 *               > .links-grid (drag-sortable cards, 148px min)
 *
 * Card has hover-only edit/delete buttons (top-right) and a star
 * favorite toggle in the bottom row. Modal uses the `standard` variant
 * (header X close + right-aligned footer + 4-tab icon picker).
 *
 * The body is extracted into <LinksLibrary /> so it can also be rendered
 * inside a popup from the sidebar — same look, same data, same edit flow.
 */
export function LinksPage() {
  return (
    <div className="page-inner">
      <LinksLibrary />
    </div>
  );
}
