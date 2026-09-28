import type { ReactNode } from 'react';
import { TimerProvider, useTimers } from '@/context/TimerContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Modal } from '@/components/ui/Modal';
import '@/styles/widgets.css';

function TimerAlerts() {
  const timers = useTimers();
  const alerts = [
    { active: timers.getTimer('countdown').remainingMs === 0 && timers.getTimer('countdown').zeroedAt !== null, title: 'Nedtellingen er ferdig', stop: timers.resetCountdown },
    { active: timers.getTimer('pomodoro').completed, title: 'Fokusøktene er fullført', stop: timers.resetPomodoro },
    { active: timers.getTimer('alarm').ringing, title: 'Alarmen ringer', stop: timers.stopAlarm },
  ].filter((alert) => alert.active);
  if (!alerts.length) return null;
  return <Modal open title="Timer ferdig" variant="standard" onOpenChange={(open) => { if (!open) alerts.forEach((alert) => alert.stop()); }}>
    <div className="widget-completion" role="status">{alerts.map((alert) => <div key={alert.title}><strong>{alert.title}</strong><button className="widget-button widget-primary" onClick={alert.stop}>Stopp lyd</button></div>)}</div>
  </Modal>;
}

export function WidgetTimerProvider({ children }: { children: ReactNode }) {
  const { data: user } = useCurrentUser();
  if (!user) return null;
  return <TimerProvider userId={user.id}>{children}<TimerAlerts /></TimerProvider>;
}
