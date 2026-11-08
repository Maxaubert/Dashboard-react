import type { LinkItem } from '@/api/types';
import { faviconUrl } from '@/lib/favicon';
import { resolveSvgIcon } from '@/data/svgIcons';
import { getDomain } from '@/lib/linkUtils';

/** Icon renderer shared by both the Lenker overlay grid and Home favorites. */
export function LinkIconRender({ link }: { link: LinkItem }) {
  if (link.iconType === 'svg' && link.iconValue) {
    const ic = resolveSvgIcon(link.iconValue);
    if (ic) {
      const Icon = ic.Component;
      return <Icon size={26} strokeWidth={1.75} />;
    }
  }
  // Legacy `emoji` icons - render the character so old data still displays.
  if (link.iconType === 'emoji' && link.iconValue) {
    return <span className="emoji-icon" style={{ fontSize: 26, lineHeight: 1 }}>{link.iconValue}</span>;
  }
  if (link.iconType === 'image' && link.iconValue) {
    return <img src={link.iconValue} alt="" width={26} height={26} />;
  }
  // favicon (default) - derive domain from URL
  const domain = getDomain(link.url);
  if (!domain) return null;
  return <img src={faviconUrl(domain)} alt="" width={26} height={26} />;
}
