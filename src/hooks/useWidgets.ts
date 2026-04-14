import { useCallback } from 'react';
import { randomId } from '@/lib/randomId';
import { useHome, useMutateHome } from './useHome';
import type { HomeWidget } from '@/api/types';

// Keep the existing public types so consumers don't change.
export type WidgetType = HomeWidget['type'];
export type Widget = HomeWidget;

export function useWidgets() {
  const { data } = useHome();
  const mutate = useMutateHome();

  const widgets: Widget[] = data?.widgets ?? [];

  const addWidget = useCallback(
    (type: WidgetType, refId: string): Widget => {
      const widget: Widget = { id: randomId(), type, refId };
      mutate((prev) => {
        // Dedupe by (type, refId): see StrictMode note in the historical
        // useWidgets — multiple callers can race on the same add.
        if (prev.widgets.some((w) => w.type === type && w.refId === refId)) return prev;
        return { ...prev, widgets: [...prev.widgets, widget] };
      });
      return widget;
    },
    [mutate],
  );

  const removeWidget = useCallback(
    (id: string) => {
      mutate((prev) => {
        const next = prev.widgets.filter((w) => w.id !== id);
        if (next.length === prev.widgets.length) return prev;
        return { ...prev, widgets: next };
      });
    },
    [mutate],
  );

  const removeWidgetByRefId = useCallback(
    (refId: string) => {
      mutate((prev) => {
        const next = prev.widgets.filter((w) => w.refId !== refId);
        if (next.length === prev.widgets.length) return prev;
        return { ...prev, widgets: next };
      });
    },
    [mutate],
  );

  const reorderWidgets = useCallback(
    (nextOrder: Widget[]) => {
      mutate((prev) => ({ ...prev, widgets: nextOrder }));
    },
    [mutate],
  );

  return { widgets, addWidget, removeWidget, removeWidgetByRefId, reorderWidgets };
}
