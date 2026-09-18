import { useState, useEffect, useRef } from 'react';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { useChurches } from '../hooks/useChurches';
import { useEvents } from '../hooks/useEvents';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { loadEventFamilies } from '../lib/databaseClient';
import type { Church, Event, EventTag } from '../types/church';
import { ALL_EVENT_TAGS } from '../types/church';
import { createGoogleCalendarUrl } from '../utils/calendar';
import { formatTime } from '../utils/formatting';
import { getEventTagMeta } from '../utils/eventTags';
import { EventsCalendarView } from './EventsCalendarView';

type EventsTab = 'list' | 'calendar';

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
 * Check if a date is in the past
 */
export function isDatePast(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(dateStr + 'T00:00:00');
  return eventDate < today;
}

function getTagColor(tag: string): string {
  return getEventTagMeta(tag).chipClassName;
}

/**
 * Props for a single event card.
 *
 * Note: `churches` is required so that cards never trigger their own
 * database loads. Parents (e.g. `EventsView`) should use
 * the shared `useChurches` hook to load data once and pass it in.
 */
interface EventCardProps {
  event: Event;
  churches?: Church[];
}

export function EventCard({ event, churches }: EventCardProps) {
  const isPast = isDatePast(event.date);
  const timeDisplay = formatEventTime(event);
  const effectiveChurches = churches ?? [];

  function resolveAddress() {
    if (event.church_id && effectiveChurches.length > 0) {
      const match = effectiveChurches.find((church) => church.id === event.church_id);
      if (match?.address) return match.address;
    }
    return null;
  }

  const resolvedAddress = resolveAddress();

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow flex flex-col h-full ${
        isPast ? 'opacity-60' : ''
      }`}
    >
      <div className="flex-1">
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
              {getEventTagMeta(tag).label}
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
            <span>{event.church_name || event.family_of_parishes}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <a
            href={createGoogleCalendarUrl({
              title: event.title,
              description: event.description,
              location: resolvedAddress || event.location || undefined,
              date: event.date,
              start_time: event.start_time || undefined,
              end_time: event.end_time || undefined,
            })}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            <span>Add to Google Calendar</span>
            <ArrowTopRightOnSquareIcon className="w-3 h-3 inline-block ml-1" aria-hidden="true" />
          </a>
        </div>

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
  const { churches } = useChurches();
  const [activeTab, setActiveTab] = useState<EventsTab>('list');
  const [selectedFamily, setSelectedFamily] = useState('all');
  const [selectedTag, setSelectedTag] = useState<'all' | EventTag>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [families, setFamilies] = useState<string[]>([]);
  const futureSentinelRef = useRef<HTMLDivElement>(null);
  const debouncedSearchTerm = useDebouncedValue(searchTerm);
  const {
    events,
    loading,
    loadingMore,
    error,
    loadMoreError,
    loadMoreFuture,
    loadMorePast,
    hasMoreFuture,
    hasMorePast,
    searchTooShort,
  } = useEvents({
    family: selectedFamily === 'all' ? undefined : selectedFamily,
    tag: selectedTag === 'all' ? undefined : selectedTag,
    search: debouncedSearchTerm,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const search = params.get('search') || '';
      const family = params.get('family') || 'all';
      const tag = params.get('tag') || 'all';
      const start = params.get('start') || '';
      const end = params.get('end') || '';

      setSearchTerm(search);
      setSelectedFamily(family);
      if (tag === 'all' || ALL_EVENT_TAGS.includes(tag as EventTag)) {
        setSelectedTag(tag as 'all' | EventTag);
      }
      setStartDate(start);
      setEndDate(end);
    } catch {
      // Ignore URL parsing errors.
    }
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      if (selectedFamily !== 'all') params.set('family', selectedFamily);
      if (selectedTag !== 'all') params.set('tag', selectedTag);
      if (startDate) params.set('start', startDate);
      if (endDate) params.set('end', endDate);

      const search = params.toString();
      const nextUrl = window.location.pathname + (search ? `?${search}` : '');
      window.history.replaceState(null, '', nextUrl);
    } catch {
      // Ignore history update errors.
    }
  }, [searchTerm, selectedFamily, selectedTag, startDate, endDate]);

  useEffect(() => {
    let cancelled = false;
    loadEventFamilies()
      .then((loadedFamilies) => {
        if (!cancelled) setFamilies(loadedFamilies);
      })
      .catch((reason: unknown) => console.error('Error loading event families:', reason));

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredEvents = events;

  useEffect(() => {
    if (activeTab !== 'list' || !hasMoreFuture || loadingMore) return;
    const sentinel = futureSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMoreFuture();
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeTab, hasMoreFuture, loadMoreFuture, loadingMore]);

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
        <p className="text-gray-600 mb-4">
          Parish events across the Deanery of Windsor-Essex
        </p>
        <nav className="flex justify-center" role="tablist" aria-label="Events view">
          <div className="inline-flex border-b border-gray-200">
            <button
              id="events-list-tab"
              className={`px-6 py-3 text-sm font-medium transition-colors duration-200 border-b-2 -mb-px ${
                activeTab === 'list'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('list')}
              type="button"
              role="tab"
              aria-selected={activeTab === 'list'}
              aria-controls="events-list-panel"
            >
              List
            </button>
            <button
              id="events-calendar-tab"
              className={`px-6 py-3 text-sm font-medium transition-colors duration-200 border-b-2 -mb-px ${
                activeTab === 'calendar'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('calendar')}
              type="button"
              role="tab"
              aria-selected={activeTab === 'calendar'}
              aria-controls="events-calendar-panel"
            >
              Calendar
            </button>
          </div>
        </nav>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
        <div className="flex flex-wrap gap-6 items-end">
          <div className="flex-1 min-w-[220px]">
            <label htmlFor="search" className="block text-sm font-semibold text-gray-700 mb-2">
              Search
            </label>
            <input
              id="search"
              type="search"
              placeholder="Search events"
              maxLength={100}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            {searchTooShort && (
              <p className="mt-1 text-xs text-gray-500">Enter at least 2 characters to search.</p>
            )}
          </div>

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
                onChange={(event) => setSelectedFamily(event.target.value)}
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
            <label htmlFor="tag-filter" className="block text-sm font-semibold text-gray-700 mb-2">
              Event Type
            </label>
            <div className="relative">
              <select
                id="tag-filter"
                value={selectedTag}
                onChange={(event) => setSelectedTag(event.target.value as 'all' | EventTag)}
                className="w-full appearance-none bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer hover:bg-gray-100"
              >
                <option value="all">All Types</option>
                {ALL_EVENT_TAGS.map((tag) => (
                  <option key={tag} value={tag}>
                    {getEventTagMeta(tag).label}
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

        </div>

        <div className="flex flex-wrap gap-6 items-end mt-4 pt-4 border-t border-gray-100">
          <div className="flex-1 min-w-[150px]">
            <label htmlFor="start-date" className="block text-sm font-semibold text-gray-700 mb-2">
              From Date
            </label>
            <input
              type="date"
              id="start-date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer hover:bg-gray-100"
            />
          </div>

          <div className="flex-1 min-w-[150px]">
            <label htmlFor="end-date" className="block text-sm font-semibold text-gray-700 mb-2">
              To Date
            </label>
            <input
              type="date"
              id="end-date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer hover:bg-gray-100"
            />
          </div>

          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Clear dates
            </button>
          )}
        </div>
      </div>

      {activeTab === 'list' && (
        <div
          id="events-list-panel"
          role="tabpanel"
          aria-labelledby="events-list-tab"
        >
          <p className="text-sm text-gray-500 mb-4">
            Showing {filteredEvents.length} loaded event{filteredEvents.length !== 1 ? 's' : ''}
          </p>

          {hasMorePast && (
            <div className="flex justify-center mb-5">
              <button
                type="button"
                onClick={loadMorePast}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-wait"
                aria-label="Load earlier events"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m5 15 7-7 7 7" />
                </svg>
                Load earlier events
              </button>
            </div>
          )}

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
                <EventCard key={event.id} event={event} churches={churches} />
              ))}
            </div>
          )}
          {hasMoreFuture && <div ref={futureSentinelRef} className="h-8" aria-hidden="true" />}
          {loadingMore && <p className="text-center text-sm text-gray-500 py-4" aria-live="polite">Loading more events…</p>}
          {loadMoreError && <p className="text-center text-sm text-red-600 py-4" role="alert">{loadMoreError}</p>}
        </div>
      )}

      {activeTab === 'calendar' && (
        <div
          id="events-calendar-panel"
          role="tabpanel"
          aria-labelledby="events-calendar-tab"
        >
          <p className="text-sm text-gray-500 mb-4">
            Events load one month at a time as you navigate the calendar.
          </p>
          <EventsCalendarView
            selectedTag={selectedTag === 'all' ? null : selectedTag}
            family={selectedFamily === 'all' ? undefined : selectedFamily}
            search={debouncedSearchTerm}
            startDate={startDate || undefined}
            endDate={endDate || undefined}
          />
        </div>
      )}

      <p className="text-xs text-gray-400 text-center mt-8">
        Events are automatically extracted from parish bulletins. Some information may be incomplete.
      </p>
    </div>
  );
}
