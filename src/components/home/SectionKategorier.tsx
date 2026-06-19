import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { GripHandle, type HandleProps } from '@/components/home/GripHandle';

interface CategoryDef {
  to: string;
  label: string;
  desc: string;
  variant: 'plan' | 'notater' | 'sport' | 'gaming';
  icon: React.ReactNode;
}

const CATEGORIES: CategoryDef[] = [
  {
    to: '/plan',
    label: 'Plan',
    desc: 'Ukeplan og timeplan',
    variant: 'plan',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 3h-1V1h-2v2H8V1H6v2H5C3.9 3 3 3.9 3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" />
      </svg>
    ),
  },
  {
    to: '/notes',
    label: 'Notater',
    desc: 'Egne notater',
    variant: 'notater',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 18h12v-2H3v2zm0-5h12v-2H3v2zm0-7v2h12V6H3zm14 9.34V7h-2v11.34l1 .66 1-.66z" />
      </svg>
    ),
  },
  {
    to: '/sport',
    label: 'Sport',
    desc: 'Sendinger og resultater',
    variant: 'sport',
    icon: (
      <svg width="16" height="16" viewBox="0 0 576 512" fill="currentColor">
        <path d="M336 96a48 48 0 1 0 -96 0 48 48 0 1 0 96 0zM244.6 144.4c-9.2-3.4-16.9-9.6-22-17.6l-147-147c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c6 6 14.1 9.3 22.6 9.3l64.1 0zM224 256l0 128-64 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l128 0 128 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-64 0 0-128 0-50.7 129.5-129.5c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 158.6 266.6 137.3c3.5 8.1 5.4 17 5.4 26.3l0 32.7L224 196.9 224 256z" />
      </svg>
    ),
  },
  {
    to: '/gaming',
    label: 'Gaming',
    desc: 'Steam ønskeliste',
    variant: 'gaming',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21 6H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1zm-10 9H8v-3H5v-2h3V7h2v3h3v2h-3v3zm4.5 1a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-3a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
      </svg>
    ),
  },
];

export function KategorierSection({ handleProps }: { handleProps?: HandleProps }) {
  return (
    <section>
      <div className="section-header">
        <span>
          <GripHandle handleProps={handleProps} />
          Kategorier
        </span>
      </div>
      <div className="cards-grid">
        {CATEGORIES.map((cat) => (
          <Link key={cat.to} to={cat.to} className={cn('card', cat.variant)}>
            <div className="card-icon">{cat.icon}</div>
            <div className="card-body">
              <div className="card-title">{cat.label}</div>
              <div className="card-desc">{cat.desc}</div>
            </div>
            <div className="card-arrow">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
