import type { LinkItem } from '@/api/types';
import type { SectionRender } from './groupLinks';

export interface ActiveLinkDrag {
  id: string;
  linkId: string;
  sectionId: string;
}

/** Each displayed copy needs its own ID. Keep the active ID stable while moving it. */
export function linkDragId(sectionId: string, linkId: string, active?: ActiveLinkDrag | null) {
  if (active?.sectionId === sectionId && active.linkId === linkId) return active.id;
  return `link:${JSON.stringify([sectionId, linkId])}`;
}

export function moveLinkPreview(
  sections: SectionRender[],
  active: ActiveLinkDrag,
  destinationId: string,
  overLinkId?: string,
): SectionRender[] {
  const source = sections.find((section) => section.category.id === active.sectionId);
  const moved = source?.links.find((link) => link.id === active.linkId);
  if (!moved || active.sectionId === destinationId) return sections;

  return sections.map((section) => {
    if (section.category.id === active.sectionId) {
      return { ...section, links: section.links.filter((link) => link.id !== active.linkId) };
    }
    if (section.category.id !== destinationId) return section;
    // The destination may already display the favorite's other copy.
    const target = section.links.filter((link) => link.id !== active.linkId);
    const overIndex = target.findIndex((link) => link.id === overLinkId);
    target.splice(overIndex < 0 ? target.length : overIndex, 0, moved);
    return { ...section, links: target };
  });
}

/** Persist canonical records, never flatten the duplicated Favorites view. */
export function applyLinkDrop(
  links: LinkItem[],
  destination: SectionRender,
  activeLinkId: string,
  now: number,
): LinkItem[] {
  const byId = new Map(links.map((link) => [link.id, link]));
  const ordered = destination.links.map((link) => byId.get(link.id)).filter(
    (link): link is LinkItem => link !== undefined,
  );
  const reorderedIds = new Set(ordered.map((link) => link.id));
  let index = 0;
  return links.map((original) => {
    const link = reorderedIds.has(original.id) ? ordered[index++] : original;
    if (link.id !== activeLinkId) return link;
    return {
      ...link,
      ...(destination.kind === 'favorites'
        ? { favorite: true }
        : { category: destination.kind === 'other' ? undefined : destination.category.id }),
      updatedAt: now,
    };
  });
}
