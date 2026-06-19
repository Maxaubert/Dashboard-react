import { describe, it, expect, vi, beforeEach } from 'vitest';

const single = vi.fn();
const eq = vi.fn(() => ({ maybeSingle: single }));
const select = vi.fn(() => ({ eq }));
const upsert = vi.fn(() => Promise.resolve({ error: null }));
vi.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ select, upsert }) },
}));

import { readDoc, writeDoc } from './docStore';

beforeEach(() => { single.mockReset(); upsert.mockClear(); });

describe('readDoc', () => {
  it('returns stored data when present', async () => {
    single.mockResolvedValue({ data: { data: [1, 2, 3] }, error: null });
    expect(await readDoc('todos', [])).toEqual([1, 2, 3]);
  });
  it('returns the fallback when no row exists', async () => {
    single.mockResolvedValue({ data: null, error: null });
    expect(await readDoc('todos', [])).toEqual([]);
  });
});

describe('writeDoc', () => {
  it('upserts the kind + data', async () => {
    await writeDoc('plan', [{ id: 'x' }]);
    expect(upsert).toHaveBeenCalledWith(
      { kind: 'plan', data: [{ id: 'x' }] },
      { onConflict: 'user_id,kind' }
    );
  });
});
