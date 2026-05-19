import { useRef, useState } from 'react';
import { useLinks } from '@/hooks/useLinks';
import type { LinkItem } from '@/api/types';
import { Modal } from '@/components/ui';
import { IconPicker, type IconPickerHandle } from '@/components/patterns';
import { LINK_COLOR_PRESETS } from '@/data/linkColors';
import { cn } from '@/lib/cn';
import { CategoryPickerRow } from '@/components/links/CategoryPickerRow';
import { useCategories } from '@/hooks/useCategories';

/* ── Edit modal ──────────────────────────────────────────────────────────── */
export interface LinkEditModalProps {
  item: LinkItem | null;
  defaultCategoryId?: string;
  onClose: () => void;
  onSave: (item: LinkItem) => void;
  onDelete?: () => void;
}

export function LinkEditModal({ item, defaultCategoryId, onClose, onSave, onDelete }: LinkEditModalProps) {
  const [form, setForm] = useState<LinkItem>(
    item ?? {
      id: `link_${Date.now()}`,
      url: '',
      name: '',
      sub: '',
      color: LINK_COLOR_PRESETS[6], // legacy default purple
      favorite: false,
      category: defaultCategoryId,
    }
  );
  const pickerRef = useRef<IconPickerHandle>(null);
  const { categories, create: createCategory } = useCategories();
  const { data: envelope } = useLinks();
  const allLinks = envelope?.links ?? [];

  function update<K extends keyof LinkItem>(key: K, value: LinkItem[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (!form.url.trim() || !form.name.trim()) return;
    const icon = pickerRef.current
      ? await pickerRef.current.resolve(form.url)
      : { iconType: 'favicon' as const, iconValue: '' };
    onSave({ ...form, iconType: icon.iconType, iconValue: icon.iconValue });
  }

  const liveDomain = (() => {
    try {
      return new URL(form.url).hostname;
    } catch {
      return '';
    }
  })();

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={item ? 'Rediger lenke' : 'Ny lenke'}
      size="lg"
      variant="standard"
      footer={
        <>
          {onDelete && (
            <button className="btn-delete-std" onClick={onDelete}>
              Slett
            </button>
          )}
          <button className="btn-cancel-std" onClick={onClose}>
            Avbryt
          </button>
          <button className="btn-save-std" onClick={handleSubmit}>
            Lagre
          </button>
        </>
      }
    >
      {/* URL */}
      <div className="modal-row">
        <label htmlFor="f-url">URL</label>
        <input
          id="f-url"
          type="url"
          placeholder="https://…"
          value={form.url}
          onChange={(e) => update('url', e.target.value)}
        />
      </div>

      {/* Name + sub */}
      <div className="modal-row-2col">
        <div>
          <label htmlFor="f-name">Navn</label>
          <input
            id="f-name"
            type="text"
            placeholder="YouTube"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="f-sub">Undertekst</label>
          <input
            id="f-sub"
            type="text"
            placeholder="Video"
            value={form.sub ?? ''}
            onChange={(e) => update('sub', e.target.value)}
          />
        </div>
      </div>

      {/* Color */}
      <div className="modal-row">
        <label>Farge</label>
        <div className="ext-color-row">
          {LINK_COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => update('color', c)}
              style={{ background: c }}
              className={cn('ext-color-swatch', form.color === c && 'selected')}
              aria-label={`Velg farge ${c}`}
            />
          ))}
          <div className="color-custom-wrap" title="Egendefinert farge">
            <div className="color-custom-btn" />
            <input
              type="color"
              value={form.color ?? '#a78bfa'}
              onChange={(e) => update('color', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Category */}
      <div className="modal-row">
        <label>Kategori</label>
        <CategoryPickerRow
          categories={categories}
          links={allLinks}
          value={form.category}
          onChange={(next) => update('category', next)}
          onCreate={createCategory}
        />
      </div>

      {/* Icon picker */}
      <div className="modal-row">
        <label>Ikon</label>
        <IconPicker
          ref={pickerRef}
          initial={{ iconType: form.iconType, iconValue: form.iconValue }}
          domainHint={liveDomain}
        />
      </div>
    </Modal>
  );
}
