export type EventType = 'mass' | 'daily_mass' | 'confession' | 'adoration';
export type EventFilterState = Record<EventType, boolean>;

export const EVENT_TYPE_META: Record<EventType, { label: string; color: string }> = {
  mass: { label: 'Mass', color: '#1d4ed8' },
  daily_mass: { label: 'Daily Mass', color: '#0e7490' },
  confession: { label: 'Confession', color: '#be123c' },
  adoration: { label: 'Adoration', color: '#a16207' },
};

const WEEKDAY_CODES: Record<string, string> = {
  sunday: 'SU',
  monday: 'MO',
  tuesday: 'TU',
  wednesday: 'WE',
  thursday: 'TH',
  friday: 'FR',
  saturday: 'SA',
};

/**
 * Convert the schedule's recurrence metadata into a Google Calendar RRULE.
 * Unsupported/unknown schedule labels intentionally return no rule so the
 * exported link remains a single event rather than making an unsafe guess.
 */
export function scheduleToRecurrence(day: string, dayOfMonth?: number, note?: string): string | undefined {
  const normalizedDay = day.trim().toLowerCase();
  if (normalizedDay === 'every day') return 'RRULE:FREQ=DAILY';

  const weekday = WEEKDAY_CODES[normalizedDay];
  if (!weekday) return undefined;

  // The calendar data uses dayOfMonth as the ordinal weekday in a month
  // (e.g. 1 = first Sunday), which Google Calendar supports directly.
  if (dayOfMonth != null && Number.isInteger(dayOfMonth) && dayOfMonth >= 1 && dayOfMonth <= 5) {
    return `RRULE:FREQ=MONTHLY;BYDAY=${dayOfMonth}${weekday}`;
  }

  // “Every second Friday” is the source data's wording for an every-other-
  // week schedule. Prefer this explicit note over silently exporting weekly.
  const biweeklyPattern = new RegExp(`\\bevery\\s+(?:other|second)\\s+${normalizedDay}\\b`, 'i');
  if (note && biweeklyPattern.test(note)) {
    return `RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=${weekday}`;
  }

  return `RRULE:FREQ=WEEKLY;BYDAY=${weekday}`;
}

export interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  type: EventType;
  churchName: string;
  churchId: string;
  location?: string;
  recurrence?: string;
  note?: string;
}
