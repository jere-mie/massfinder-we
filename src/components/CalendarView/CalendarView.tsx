import { useMemo, useState } from 'react';
import {
  Calendar,
  momentLocalizer,
  type View,
} from 'react-big-calendar';
import moment, { type Moment } from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import type { Church, Mass, TimeRange } from '../../types/church';
import {
  EVENT_TYPE_META,
  type CalendarEvent,
  type EventFilterState,
  type EventType,
} from './calendarTypes';
import { EventDetailsModal } from './EventDetailsModal';
import { FilterBar } from './FilterBar';

const localizer = momentLocalizer(moment);
const DAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function applyTime(date: Moment, hhmm: string): Moment {
  return date
    .clone()
    .hour(Number(hhmm.slice(0, 2)))
    .minute(Number(hhmm.slice(2, 4)))
    .second(0)
    .millisecond(0);
}

function matchesOrdinal(date: Moment, ordinal?: number): boolean {
  return ordinal == null || Math.ceil(date.date() / 7) === ordinal;
}

/** Find schedule occurrences inside the calendar's current rendering window. */
function datesForSchedule(dayName: string, rangeStart: Moment, rangeEnd: Moment): Moment[] {
  const normalizedDay = dayName.trim().toLowerCase();
  const isEveryDay = normalizedDay === 'every day';
  const weekday = DAY_INDEX[normalizedDay];

  if (!isEveryDay && weekday == null) {
    console.warn(`Unknown schedule day: "${dayName}"`);
    return [];
  }

  const dates: Moment[] = [];
  const cursor = rangeStart.clone().startOf('day');
  while (cursor.isSameOrBefore(rangeEnd, 'day')) {
    if (isEveryDay || cursor.day() === weekday) dates.push(cursor.clone());
    cursor.add(1, 'day');
  }
  return dates;
}

function massToEvents(
  mass: Mass,
  church: Church,
  daily: boolean,
  rangeStart: Moment,
  rangeEnd: Moment,
): CalendarEvent[] {
  const type: EventType = daily ? 'daily_mass' : 'mass';
  return datesForSchedule(mass.day, rangeStart, rangeEnd)
    .filter((date) => matchesOrdinal(date, mass.dayOfMonth))
    .map((date) => {
      const start = applyTime(date, mass.time);
      return {
        start: start.toDate(),
        end: start.clone().add(daily ? 30 : 60, 'minutes').toDate(),
        title: `${church.name} · ${EVENT_TYPE_META[type].label}`,
        type,
        churchName: church.name,
        churchId: church.id,
        note: mass.note,
      };
    });
}

function timeRangeToEvents(
  timeRange: TimeRange,
  church: Church,
  type: 'confession' | 'adoration',
  rangeStart: Moment,
  rangeEnd: Moment,
): CalendarEvent[] {
  return datesForSchedule(timeRange.day, rangeStart, rangeEnd)
    .filter((date) => matchesOrdinal(date, timeRange.dayOfMonth))
    .map((date) => {
      const allDay = timeRange.start === '0000' && timeRange.end === '2359';
      const start = applyTime(date, timeRange.start);
      let end = allDay ? date.clone().add(1, 'day').startOf('day') : applyTime(date, timeRange.end);
      if (!allDay && end.isSameOrBefore(start)) end = end.add(1, 'day');

      return {
        start: start.toDate(),
        end: end.toDate(),
        allDay,
        title: `${church.name} · ${EVENT_TYPE_META[type].label}`,
        type,
        churchName: church.name,
        churchId: church.id,
        note: timeRange.note,
      };
    });
}

interface Props {
  churches: Church[];
}

export function CalendarView({ churches }: Props) {
  const [filters, setFilters] = useState<EventFilterState>({
    mass: true,
    daily_mass: false,
    confession: false,
    adoration: false,
  });
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [date, setDate] = useState(() => new Date());
  const [view, setView] = useState<View>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
      ? 'agenda'
      : 'month',
  );

  const events = useMemo(() => {
    // One month of padding on each side covers month, day, and 14-day agenda views.
    const rangeStart = moment(date).startOf('month').subtract(1, 'month').startOf('week');
    const rangeEnd = moment(date).endOf('month').add(1, 'month').endOf('week');
    const all: CalendarEvent[] = [];

    for (const church of churches) {
      for (const mass of church.masses) {
        all.push(...massToEvents(mass, church, false, rangeStart, rangeEnd));
      }
      for (const mass of church.daily_masses) {
        all.push(...massToEvents(mass, church, true, rangeStart, rangeEnd));
      }
      for (const confession of church.confession) {
        all.push(...timeRangeToEvents(confession, church, 'confession', rangeStart, rangeEnd));
      }
      for (const adoration of church.adoration) {
        all.push(...timeRangeToEvents(adoration, church, 'adoration', rangeStart, rangeEnd));
      }
    }

    return all;
  }, [churches, date]);

  const visibleEvents = useMemo(
    () =>
      events
        .filter((event) => filters[event.type])
        .sort((a, b) => {
          const timeDifference = Number(a.start) - Number(b.start);
          return timeDifference || a.churchName.localeCompare(b.churchName);
        }),
    [events, filters],
  );

  return (
    <section className="calendar-section schedule-calendar-section" aria-label="Schedule calendar">
      <FilterBar filters={filters} setFilters={setFilters} />
      <p className="calendar-help-text">
        Choose one or more schedule types. Crowded dates are condensed; select “more” to open that day.
      </p>
      <div className="calendar-container schedule-calendar-container">
        <Calendar<CalendarEvent>
          localizer={localizer}
          events={visibleEvents}
          date={date}
          view={view}
          onNavigate={setDate}
          onView={setView}
          startAccessor="start"
          endAccessor="end"
          step={15}
          timeslots={4}
          views={['month', 'day', 'agenda']}
          length={14}
          dayLayoutAlgorithm="no-overlap"
          popup={false}
          onShowMore={(_items, selectedDate) => {
            setDate(selectedDate);
            setView('day');
          }}
          onSelectEvent={setSelectedEvent}
          eventPropGetter={(event) => ({
            className: 'calendar-event',
            style: { backgroundColor: EVENT_TYPE_META[event.type].color, color: '#fff' },
          })}
          tooltipAccessor={(event) => `${event.churchName} — ${EVENT_TYPE_META[event.type].label}`}
          scrollToTime={new Date(1970, 0, 1, 7)}
        />
      </div>
      <EventDetailsModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </section>
  );
}
