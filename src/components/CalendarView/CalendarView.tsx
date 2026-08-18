import { useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import type { EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';
import moment, { type Moment } from 'moment';

import type { Church, Mass, TimeRange } from '../../types/church';
import { useIsExtraLarge, useIsMobile } from '../../hooks/useIsMobile';
import {
  EVENT_TYPE_META,
  scheduleToRecurrence,
  type CalendarEvent,
  type EventFilterState,
  type EventType,
} from './calendarTypes';
import { EventDetailsModal } from './EventDetailsModal';
import { FilterBar } from './FilterBar';
import { scheduleTimeGridMoreLinkLayout } from './timeGridLayout';

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
  if (ordinal == null) return true;

  // Count occurrences of this weekday from the first matching weekday in the
  // month, rather than using the calendar week containing the date. For
  // example, a first Sunday can fall on the 7th or 8th of a month.
  const firstOfMonth = date.clone().startOf('month');
  const firstOccurrence = 1 + ((date.day() - firstOfMonth.day() + 7) % 7);
  return date.date() === firstOccurrence + (ordinal - 1) * 7;
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
        location: church.address,
        recurrence: scheduleToRecurrence(mass.day, mass.dayOfMonth, mass.note),
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
        location: church.address,
        recurrence: scheduleToRecurrence(timeRange.day, timeRange.dayOfMonth, timeRange.note),
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
  const isMobile = useIsMobile();
  const isExtraLarge = useIsExtraLarge();
  const eventMaxStack = isMobile ? 3 : isExtraLarge ? 5 : 4;

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

  const calendarEvents = useMemo<EventInput[]>(
    () =>
      visibleEvents.map((event, index) => ({
        id: `${event.churchId}-${event.type}-${event.start.toISOString()}-${index}`,
        title: event.title,
        start: event.start,
        end: event.end,
        allDay: event.allDay,
        backgroundColor: EVENT_TYPE_META[event.type].color,
        borderColor: EVENT_TYPE_META[event.type].color,
        textColor: '#fff',
        extendedProps: { calendarEvent: event },
      })),
    [visibleEvents],
  );

  return (
    <section className="calendar-section schedule-calendar-section" aria-label="Schedule calendar">
      <FilterBar filters={filters} setFilters={setFilters} />
      <p className="calendar-help-text">
        Choose one or more schedule types. Select an event for details, or use the day view for a focused schedule.
      </p>
      <div className="calendar-container schedule-calendar-container">
        <FullCalendar
          key={isMobile ? 'mobile' : 'desktop'}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView={isMobile ? 'listDay' : 'dayGridMonth'}
          initialDate={date}
          events={calendarEvents}
          datesSet={(info) => setDate(info.view.currentStart)}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridDay,listDay',
          }}
          buttonText={{ today: 'Today', month: 'Month', day: 'Day', list: 'List' }}
          allDayText="All Day"
          moreLinkText="More"
          noEventsText="No Events"
          height="100%"
          expandRows={isMobile}
          slotMinTime="06:00:00"
          slotMaxTime="23:00:00"
          slotDuration="00:30:00"
          slotLabelInterval="01:00:00"
          eventMinHeight={36}
          slotEventOverlap={false}
          eventMaxStack={eventMaxStack}
          dayMaxEvents={isMobile ? 1 : 3}
          moreLinkClick="popover"
          moreLinkDidMount={(info) => scheduleTimeGridMoreLinkLayout(info.el.parentElement)}
          moreLinkWillUnmount={(info) => scheduleTimeGridMoreLinkLayout(info.el.parentElement)}
          eventDidMount={(info) => scheduleTimeGridMoreLinkLayout(info.el.parentElement?.parentElement ?? null)}
          eventWillUnmount={(info) => scheduleTimeGridMoreLinkLayout(info.el.parentElement?.parentElement ?? null)}
          scrollTime="07:00:00"
          eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
          eventClick={(info) => {
            info.jsEvent.preventDefault();
            setDate(info.event.start ?? date);
            setSelectedEvent(info.event.extendedProps.calendarEvent as CalendarEvent);
          }}
          dateClick={(info) => {
            const target = info.jsEvent.target;
            if (target instanceof Element && target.closest('.fc-event, .fc-more-link, .fc-daygrid-more-link')) {
              return;
            }
            info.view.calendar.changeView('timeGridDay', info.date);
          }}
        />
      </div>
      <EventDetailsModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </section>
  );
}
