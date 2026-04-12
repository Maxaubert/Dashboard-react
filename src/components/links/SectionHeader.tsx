import { cn } from '@/lib/cn';

interface SectionHeaderProps {
  title: string;
  count: number;
  className?: string;
}

export function SectionHeader({ title, count, className }: SectionHeaderProps) {
  return (
    <div className={cn('links-section-header', className)}>
      <span className="links-section-title">{title}</span>
      <span className="links-section-count">{count}</span>
    </div>
  );
}
