import { AlarmClock, CircleCheck, Hourglass, Timer, Watch } from 'lucide-react';

export const WIDGET_KINDS = {
  habit: { title: 'Vanesporing', description: 'Små steg, hver dag. Følg vanene dine.', icon: CircleCheck },
  pomodoro: { title: 'Pomodoro', description: 'Veksle mellom fokus og pauser.', icon: Timer },
  countdown: { title: 'Nedtelling', description: 'Sett av tid til det du holder på med.', icon: Hourglass },
  stopwatch: { title: 'Stoppeklokke', description: 'Ta tiden, i ditt eget tempo.', icon: Watch },
  alarm: { title: 'Alarm', description: 'Få en påminnelse på et bestemt tidspunkt.', icon: AlarmClock },
};
export type WidgetKind = keyof typeof WIDGET_KINDS;
export type TimerKind = Exclude<WidgetKind, 'habit'>;
