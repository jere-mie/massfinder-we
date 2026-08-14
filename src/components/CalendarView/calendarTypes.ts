import type { Event as RBCEvent } from 'react-big-calendar';

export type EventType = 'mass' | 'daily_mass' | 'confession' | 'adoration';
export type EventFilterState = Record<EventType, boolean>;

export const EVENT_TYPE_META: Record<EventType, { label: string; color: string }> = {
  mass: { label: 'Mass', color: '#1d4ed8' },
  daily_mass: { label: 'Daily Mass', color: '#0e7490' },
  confession: { label: 'Confession', color: '#be123c' },
  adoration: { label: 'Adoration', color: '#a16207' },
};

export interface CalendarEvent extends RBCEvent {
  type: EventType;
  churchName: string;
  churchId: string;
  note?: string;
}
