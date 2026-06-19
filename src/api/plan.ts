import { readDoc, writeDoc } from '@/lib/docStore';
import type { PlanItem } from './types';

export const planApi = {
  list: () => readDoc<PlanItem[]>('plan', []),
  saveAll: async (items: PlanItem[]) => {
    await writeDoc('plan', items);
    return { ok: true };
  },
};
