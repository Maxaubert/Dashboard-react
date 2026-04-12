import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface SectionHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  count: number;
  gripRef?: (node: HTMLElement | null) => void;
  gripListeners?: HTMLAttributes<HTMLElement>;
  dragging?: boolean;
}

export const SectionHeader = forwardRef<HTMLDivElement, SectionHeaderProps>(
  function SectionHeader(
    { title, count, gripRef, gripListeners, dragging, className, ...rest },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={cn('links-section-header', dragging && 'dragging', className)}
        {...rest}
      >
        <span
          ref={gripRef}
          className="links-section-grip"
          {...(gripListeners as React.HTMLAttributes<HTMLElement>)}
          aria-label="Dra for å flytte seksjon"
        >
          ⋮⋮
        </span>
        <span className="links-section-title">{title}</span>
        <span className="links-section-count">{count}</span>
      </div>
    );
  },
);
