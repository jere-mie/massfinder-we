import { useEffect, useRef } from 'react';
import moment from 'moment';
import { EVENT_TYPE_META, type CalendarEvent } from './calendarTypes';

interface Props {
  event: CalendarEvent | null;
  onClose: () => void;
}

export function EventDetailsModal({ event, onClose }: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!event) return;
    closeButtonRef.current?.focus();
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [event, onClose]);

  if (!event) return null;

  const start = moment(event.start);
  const end = moment(event.end);
  const endFormat = end.isSame(start, 'day') ? 'h:mm A' : 'ddd h:mm A';

  return (
    <div className="calendar-modal-backdrop" onMouseDown={onClose}>
      <div
        className="calendar-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-calendar-modal-title"
        onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
      >
        <h2 id="schedule-calendar-modal-title" className="text-lg font-bold text-gray-900 mb-4">
          Schedule details
        </h2>
        <dl className="calendar-modal-details">
          <div>
            <dt>Church</dt>
            <dd>
              <a className="text-blue-700 hover:underline" href={`/church/${event.churchId}`}>
                {event.churchName}
              </a>
            </dd>
          </div>
          <div>
            <dt>When</dt>
            <dd>
              {event.allDay
                ? `${start.format('dddd, MMMM D')} · All day`
                : `${start.format('dddd, MMMM D · h:mm A')} – ${end.format(endFormat)}`}
            </dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{EVENT_TYPE_META[event.type].label}</dd>
          </div>
          {event.note && (
            <div>
              <dt>Notes</dt>
              <dd>{event.note}</dd>
            </div>
          )}
        </dl>
        <div className="calendar-modal-actions">
          <button ref={closeButtonRef} type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
