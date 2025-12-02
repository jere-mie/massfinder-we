import { useState, useMemo } from 'react';
import { useEvents } from '../hooks/useEvents';
import { formatTime } from '../utils/formatting';
import type { Event } from '../types/church';

/**
 * Format a date string to a readable format
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format event time display
 */
function formatEventTime(event: Event): string {
  if (!event.start_time && !event.end_time) return '';
  if (event.start_time && event.end_time) {
    return `${formatTime(event.start_time)} - ${formatTime(event.end_time)}`;
  }
  if (event.start_time) return formatTime(event.start_time);
  if (event.end_time) return `Until ${formatTime(event.end_time)}`;
  return '';
}

/**
 * Get unique values from events for filtering
 */
function getUniqueValues(events: Event[], key: 'family_of_parishes' | 'tags'): string[] {
  const values = new Set<string>();
  events.forEach((event) => {
    if (key === 'tags') {
      event.tags.forEach((tag) => values.add(tag));
    } else {
      values.add(event[key]);
    }
  });
  return Array.from(values).sort();
}

/**
 * Check if a date is in the past
 */
function isDatePast(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(dateStr + 'T00:00:00');
  return eventDate < today;
}

/**
 * Tag colors for visual distinction
 */
const TAG_COLORS: Record<string, string> = {
  liturgy: 'bg-purple-100 text-purple-800',
  social: 'bg-blue-100 text-blue-800',
  fundraiser: 'bg-green-100 text-green-800',
  education: 'bg-yellow-100 text-yellow-800',
  meeting: 'bg-gray-100 text-gray-800',
  community: 'bg-orange-100 text-orange-800',
  seasonal: 'bg-red-100 text-red-800',
  other: 'bg-slate-100 text-slate-800',
};

function getTagColor(tag: string): string {
  return TAG_COLORS[tag.toLowerCase()] || TAG_COLORS.other;
}

interface EventCardProps {
  event: Event;
}

function EventCard({ event }: EventCardProps) {
  const isPast = isDatePast(event.date);
  const timeDisplay = formatEventTime(event);

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow ${
        isPast ? 'opacity-60' : ''
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-gray-900 text-lg">{event.title}</h3>
        {isPast && (
          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
            Past
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {event.tags.map((tag) => (
          <span
            key={tag}
            className={`text-xs px-2 py-0.5 rounded-full ${getTagColor(tag)}`}
          >
            {tag}
          </span>
        ))}
      </div>

      <p className="text-gray-600 text-sm mb-3">{event.description}</p>

      <div className="space-y-1 text-sm">
        <div className="flex items-center gap-2 text-gray-700">
          <svg
            className="w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span>{formatDate(event.date)}</span>
          {timeDisplay && <span className="text-gray-500">• {timeDisplay}</span>}
        </div>

        {event.location && (
          <div className="flex items-center gap-2 text-gray-700">
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span>{event.location}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-gray-500">
          <svg
            className="w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <span>
            {event.church_name || event.family_of_parishes}
          </span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100">
        <a
          href={event.source_bulletin_link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
        >
          View source bulletin →
        </a>
      </div>
    </div>
  );
}

export function EventsView() {
  const { events, loading, error } = useEvents();
  const [selectedFamily, setSelectedFamily] = useState('all');
  const [selectedTag, setSelectedTag] = useState('all');
  const [showPastEvents, setShowPastEvents] = useState(false);

  const families = useMemo(() => getUniqueValues(events, 'family_of_parishes'), [events]);
  const tags = useMemo(() => getUniqueValues(events, 'tags'), [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Filter by family
      if (selectedFamily !== 'all' && event.family_of_parishes !== selectedFamily) {
        return false;
      }
      // Filter by tag
      if (selectedTag !== 'all' && !event.tags.includes(selectedTag)) {
        return false;
      }
      // Filter past events
      if (!showPastEvents && isDatePast(event.date)) {
        return false;
      }
      return true;
    });
  }, [events, selectedFamily, selectedTag, showPastEvents]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-gray-500">Loading events...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-red-500">Error loading events: {error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
          Upcoming Events
        </h1>
        <p className="text-gray-600">
          Parish events across the Deanery of Windsor-Essex
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
        <div className="flex flex-wrap gap-6 items-end">
          <div className="flex-1 min-w-[200px]">
            <label
              htmlFor="family-filter"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              Family of Parishes
            </label>
            <div className="relative">
              <select
                id="family-filter"
                value={selectedFamily}
                onChange={(e) => setSelectedFamily(e.target.value)}
                className="w-full appearance-none bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer hover:bg-gray-100"
              >
                <option value="all">All Families</option>
                {families.map((family) => (
                  <option key={family} value={family}>
                    {family}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <svg className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label
              htmlFor="tag-filter"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              Event Type
            </label>
            <div className="relative">
              <select
                id="tag-filter"
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="w-full appearance-none bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer hover:bg-gray-100"
              >
                <option value="all">All Types</option>
                {tags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag.charAt(0).toUpperCase() + tag.slice(1)}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <svg className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pb-1">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                id="show-past"
                checked={showPastEvents}
                onChange={(e) => setShowPastEvents(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              <span className="ml-3 text-sm font-medium text-gray-700">Show past events</span>
            </label>
          </div>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500 mb-4">
        Showing {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
      </p>

      {/* Events grid */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <svg
            className="w-12 h-12 mx-auto mb-4 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p>No events found matching your filters.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {/* Footer note */}
      <p className="text-xs text-gray-400 text-center mt-8">
        Events are automatically extracted from parish bulletins. Some information may be incomplete.
      </p>
    </div>
  );
}
