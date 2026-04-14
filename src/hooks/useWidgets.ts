import { useCallback } from 'react';
import { randomId } from '@/lib/randomId';
import { useHome, useSaveHome } from './useHome';
import type { HomeEnvelope, HomeWidget } from '@/api/types';

// Keep the existing public types so consumers don't change.
export type WidgetType = HomeWidget['type'];
export type Widget = HomeWidget;

export function useWidgets() {
  const { data } = useHome();
  const save = useSaveHome();

  const widgets: Widget[] = data?.widgets ?? [];

  const commit = useCallback(
    (nextWidgets: Widget[]) => {
      const base: HomeEnvelope = data ?? { version: 1, sections: [], widgets: [], habits: [] };
      save.mutate({ ...base, widgets: nextWidgets });
    },
    [data, save],
  );

  const addWidget = useCallback(
    (type: WidgetType, refId: string): Widget => {
      const existing = widgets.find((w) => w.type === type && w.refId === refId);
      if (existing) return existing;
      const widget: Widget = { id: randomId(), type, refId };
      commit([...widgets, widget]);
      return widget;
    },
    [widgets, commit],
  );

  const removeWidget = useCallback(
    (id: string) => commit(widgets.filter((w) => w.id !== id)),
    [widgets, commit],
  );

  const removeWidgetByRefId = useCallback(
    (refId: string) => commit(widgets.filter((w) => w.refId !== refId)),
    [widgets, commit],
  );

  const reorderWidgets = useCallback(
    (nextOrder: Widget[]) => commit(nextOrder),
    [commit],
  );

  return { widgets, addWidget, removeWidget, removeWidgetByRefId, reorderWidgets };
}
