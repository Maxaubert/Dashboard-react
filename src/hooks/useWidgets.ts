import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { randomId } from '@/lib/randomId';

export type WidgetType = 'habit' | 'countdown' | 'pomodoro' | 'stopwatch' | 'alarm';

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
      const widget: Widget = { id: randomId(), type, refId };
      // Dedupe by (type, refId): React StrictMode double-invokes effects on
      // mount, and the auto-sync effect in WidgetsSection captures `widgets`
      // in a closure — so a stale closure can call addWidget twice with the
      // same (type, refId) before the next render sees the first add. Bail
      // out at the source instead of trying to coordinate at every caller.
      setWidgets((prev) => {
        if (prev.some((w) => w.type === type && w.refId === refId)) return prev;
        return [...prev, widget];
      });
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
