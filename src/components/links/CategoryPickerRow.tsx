import { useState } from 'react';
import type { Category, LinkItem } from '@/api/types';
import { FAVORITES_CATEGORY_ID, OTHER_CATEGORY_ID } from '@/api/types';
import { cn } from '@/lib/cn';

interface CategoryPickerRowProps {
  categories: Category[];
  links: LinkItem[];
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  onCreate: (name: string) => string;
}

export function CategoryPickerRow({
  categories, links, value, onChange, onCreate,
}: CategoryPickerRowProps) {
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');

  const userCats = categories
    .filter((c) => c.id !== FAVORITES_CATEGORY_ID && c.id !== OTHER_CATEGORY_ID)
    .sort((a, b) => a.order - b.order);

  const favCount = links.filter((l) => l.favorite === true).length;
  const otherCount = links.filter((l) => !l.favorite && !l.category).length;

  function countFor(catId: string): number {
    return links.filter((l) => !l.favorite && l.category === catId).length;
  }

  function commitCreate() {
    const trimmed = draftName.trim();
    if (!trimmed) { setCreating(false); setDraftName(''); return; }
    const id = onCreate(trimmed);
    if (id) onChange(id);
    setCreating(false);
    setDraftName('');
  }

  return (
    <div className="cat-picker-list">
      <div className={cn('cat-picker-row', 'disabled')} title="Bruk stjerneknappen på kortet">
        <span className="cat-picker-radio" />
        <span className="cat-picker-name">★ Favorites</span>
        <span className="cat-picker-count">{favCount}</span>
      </div>

      {userCats.map((c) => {
        const selected = value === c.id;
        return (
          <div key={c.id} className={cn('cat-picker-row', selected && 'selected')} onClick={() => onChange(c.id)}>
            <span className="cat-picker-radio" />
            <span className="cat-picker-name">{c.name}</span>
            <span className="cat-picker-count">{countFor(c.id)}</span>
          </div>
        );
      })}

      <div className={cn('cat-picker-row', value === undefined && 'selected')} onClick={() => onChange(undefined)}>
        <span className="cat-picker-radio" />
        <span className="cat-picker-name">Other</span>
        <span className="cat-picker-count">{otherCount}</span>
      </div>

      {creating ? (
        <div className="cat-picker-row create-input">
          <input autoFocus value={draftName} onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitCreate(); if (e.key === 'Escape') { setCreating(false); setDraftName(''); } }}
            placeholder="Kategorinavn…" />
          <button type="button" onClick={commitCreate}>Lagre</button>
        </div>
      ) : (
        <div className={cn('cat-picker-row', 'create')} onClick={() => setCreating(true)}>+ Ny kategori…</div>
      )}
    </div>
  );
}
