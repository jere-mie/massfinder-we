import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  momentLocalizer,
  type Event as RBCEvent,
  type View,
} from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import type { Event, EventTag } from '../types/church';
import { ALL_EVENT_TAGS } from '../types/church';
import { createGoogleCalendarUrl, getEventDateRange } from '../utils/calendar';
import { getEventTagMeta } from '../utils/eventTags';
import { formatTime } from '../utils/formatting';

const localizer = momentLocalizer(moment);

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

export interface EventCalendarItem extends RBCEvent {
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
  const [view, setView] = useState<View>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
      ? 'agenda'
      : 'month',
  );

  const calendarEvents = useMemo<EventCalendarItem[]>(() => events.map(toCalendarItem), [events]);

  return (
    <section className="calendar-section" aria-label="Events calendar">
      <ColorLegend tags={ALL_EVENT_TAGS} />
      <p className="calendar-help-text">
        Select an event for details. Crowded dates are condensed; select “more” to open that day.
      </p>
      <div className="calendar-container events-calendar-container">
        <Calendar<EventCalendarItem>
          localizer={localizer}
          events={calendarEvents}
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
          onSelectEvent={setSelectedItem}
          eventPropGetter={(item) => ({
            className: 'calendar-event',
            style: {
              backgroundColor: getEventTagMeta(
                getCalendarTag(item.originalEvent, selectedTag),
              ).calendarColor,
              color: '#fff',
            },
          })}
          tooltipAccessor={(item) =>
            `${item.originalEvent.title} — ${formatEventTime(item.originalEvent)}`
          }
          scrollToTime={new Date(1970, 0, 1, 7)}
        />
      </div>
      {selectedItem && <EventModal item={selectedItem} onClose={() => setSelectedItem(null)} />}
    </section>
  );
}
