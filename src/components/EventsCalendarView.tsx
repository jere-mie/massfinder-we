import { useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import type { EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';

import type { Event, EventTag } from '../types/church';
import { useIsExtraLarge, useIsMobile } from '../hooks/useIsMobile';
import { ALL_EVENT_TAGS } from '../types/church';
import { createGoogleCalendarUrl, getEventDateRange } from '../utils/calendar';
import { getEventTagMeta } from '../utils/eventTags';
import { formatTime } from '../utils/formatting';
import { scheduleTimeGridMoreLinkLayout } from './CalendarView/timeGridLayout';

function formatDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatEventTime(event: Event): string {
  if (!event.start_time && !event.end_time) return 'All day';
  if (event.start_time && event.end_time) {
    const nextDay = event.end_time <= event.start_time ? ' next day' : '';
    return `${formatTime(event.start_time)} – ${formatTime(event.end_time)}${nextDay}`;
  }
  if (event.start_time) return formatTime(event.start_time);
  return `Until ${formatTime(event.end_time!)}`;
}

export interface EventCalendarItem {
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  originalEvent: Event;
}

/** Use the same date-range interpretation as the calendar-export links. */
function toCalendarItem(event: Event): EventCalendarItem {
  const range = getEventDateRange(event);

  if (range.allDay) {
    const [year, month, day] = event.date.split('-').map(Number);
    const start = new Date(year, month - 1, day);
    const end = new Date(year, month - 1, day + 1);
    return { title: event.title, start, end, allDay: true, originalEvent: event };
  }

  return {
    title: event.title,
    start: range.startLocal,
    end: range.endLocal,
    allDay: false,
    originalEvent: event,
  };
}

function EventModal({ item, onClose }: { item: EventCalendarItem; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { originalEvent: event } = item;

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="calendar-modal-backdrop" onMouseDown={onClose}>
      <div
        className="calendar-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-calendar-modal-title"
        onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
      >
        <h2 id="event-calendar-modal-title" className="text-lg font-bold text-gray-900 mb-3">
          {event.title}
        </h2>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {event.tags.map((tag) => {
            const meta = getEventTagMeta(tag);
            return (
              <span key={tag} className={`text-xs px-2 py-1 rounded-full ${meta.chipClassName}`}>
                {meta.label}
              </span>
            );
          })}
        </div>

        {event.description && <p className="text-sm leading-6 text-gray-600 mb-4">{event.description}</p>}

        <dl className="calendar-modal-details">
          <div>
            <dt>Date</dt>
            <dd>{formatDate(event.date)}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>{formatEventTime(event)}</dd>
          </div>
          {event.location && (
            <div>
              <dt>Location</dt>
              <dd>{event.location}</dd>
            </div>
          )}
          <div>
            <dt>Parish</dt>
            <dd>{event.church_name ?? event.family_of_parishes}</dd>
          </div>
        </dl>

        <div className="calendar-modal-actions">
          <a
            href={createGoogleCalendarUrl({
              title: event.title,
              description: event.description,
              location: event.location,
              date: event.date,
              start_time: event.start_time,
              end_time: event.end_time,
            })}
            target="_blank"
            rel="noopener noreferrer"
          >
            Add to Google Calendar
          </a>
          <a href={event.source_bulletin_link} target="_blank" rel="noopener noreferrer">
            Source bulletin
          </a>
          <button ref={closeButtonRef} type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ColorLegend({ tags }: { tags: EventTag[] }) {
  if (tags.length === 0) return null;

  return (
    <div className="calendar-legend" aria-label="Event type colors">
      <span className="calendar-legend-label">Event types</span>
      {tags.map((tag) => {
        const meta = getEventTagMeta(tag);
        return (
          <span key={tag} className="calendar-legend-item">
            <span className="calendar-legend-swatch" style={{ backgroundColor: meta.calendarColor }} />
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}

interface Props {
  events: Event[];
  selectedTag: EventTag | null;
}

function getCalendarTag(event: Event, selectedTag: EventTag | null): EventTag {
  if (selectedTag && event.tags.includes(selectedTag)) return selectedTag;
  return event.tags[0] ?? 'other';
}

export function EventsCalendarView({ events, selectedTag }: Props) {
  const [selectedItem, setSelectedItem] = useState<EventCalendarItem | null>(null);
  const [date, setDate] = useState(() => new Date());
  const isMobile = useIsMobile();
  const isExtraLarge = useIsExtraLarge();
  const eventMaxStack = isMobile ? 3 : isExtraLarge ? 5 : 4;

  const calendarEvents = useMemo<EventCalendarItem[]>(() => events.map(toCalendarItem), [events]);
  const fullCalendarEvents = useMemo<EventInput[]>(
    () =>
      calendarEvents.map((item, index) => {
        const color = getEventTagMeta(getCalendarTag(item.originalEvent, selectedTag)).calendarColor;
        return {
          id: `${item.originalEvent.id ?? item.originalEvent.title}-${item.start.toISOString()}-${index}`,
          title: item.title,
          start: item.start,
          end: item.end,
          allDay: item.allDay,
          backgroundColor: color,
          borderColor: color,
          textColor: '#fff',
          extendedProps: { calendarItem: item },
        };
      }),
    [calendarEvents, selectedTag],
  );

  return (
    <section className="calendar-section" aria-label="Events calendar">
      <ColorLegend tags={ALL_EVENT_TAGS} />
      <p className="calendar-help-text">
        Select an event for details. Use the day view for a focused schedule when dates are busy.
      </p>
      <div className="calendar-container events-calendar-container">
        <FullCalendar
          key={isMobile ? 'mobile' : 'desktop'}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView={isMobile ? 'listDay' : 'dayGridMonth'}
          initialDate={date}
          events={fullCalendarEvents}
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
          expandRows={false}
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
            setSelectedItem(info.event.extendedProps.calendarItem as EventCalendarItem);
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
      {selectedItem && <EventModal item={selectedItem} onClose={() => setSelectedItem(null)} />}
    </section>
  );
}
