import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Override the inherited --accent for accent-styled effects. */
  accent?: string;
  /** Show the radial corner glow that picks up the accent color. */
  glow?: boolean;
  /** Show the small left vertical accent bar (matches legacy cards). */
  bar?: boolean;
  /** Make the card interactive (hover lift + cursor pointer). */
  interactive?: boolean;
  children: ReactNode;
}

/**
 * The fundamental surface used everywhere. Card replaces the dozens of
 * inline `.card` definitions across legacy pages with a single styled
 * primitive that callers extend via className.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { accent, glow = true, bar = false, interactive = false, className, style, children, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      style={accent ? { ['--accent' as string]: accent, ...style } : style}
      className={cn(
        'surface relative rounded-2xl p-5',
        glow && 'accent-glow',
        bar && 'accent-bar',
        interactive && [
          'cursor-pointer transition-all duration-200',
          'hover:border-white/[0.12] hover:-translate-y-px',
          'hover:shadow-[0_18px_40px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.06)]',
        ],
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
});

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  eyebrow?: string;
  title?: string;
  trailing?: ReactNode;
}

/**
 * Optional standardized header for cards. Use it when you want consistent
 * type hierarchy inside a card; otherwise compose freely.
 */
export function CardHeader({
  eyebrow,
  title,
  trailing,
  className,
  children,
  ...rest
}: CardHeaderProps) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)} {...rest}>
      <div className="flex flex-col gap-1">
        {eyebrow && <span className="section-label">{eyebrow}</span>}
        {title && (
          <h3 className="text-[15px] font-semibold tracking-tight text-[var(--color-text)]">
            {title}
          </h3>
        )}
        {children}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}
