import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

export type WidgetType = 'habit' | 'countdown' | 'pomodoro' | 'stopwatch';

export interface Widget {
  id: string;
  type: WidgetType;
  refId: string;
}

const STORAGE_KEY = 'home-widgets-v1';

export function useWidgets() {
  const [widgets, setWidgets] = useLocalStorage<Widget[]>(STORAGE_KEY, []);

  const addWidget = useCallback(
    (type: WidgetType, refId: string): Widget => {
      const widget: Widget = { id: crypto.randomUUID(), type, refId };
      setWidgets((prev) => [...prev, widget]);
      return widget;
    },
    [setWidgets],
  );

  const removeWidget = useCallback(
    (id: string) => setWidgets((prev) => prev.filter((w) => w.id !== id)),
    [setWidgets],
  );

  const removeWidgetByRefId = useCallback(
    (refId: string) => setWidgets((prev) => prev.filter((w) => w.refId !== refId)),
    [setWidgets],
  );

  const reorderWidgets = useCallback(
    (nextOrder: Widget[]) => setWidgets(nextOrder),
    [setWidgets],
  );

  return { widgets, addWidget, removeWidget, removeWidgetByRefId, reorderWidgets };
}
