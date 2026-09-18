import { useCallback, useEffect, useRef, useState } from 'react';
import type { Event } from '../types/church';
import { loadEvents } from '../lib/databaseClient';

const EVENT_PAGE_SIZE = 24;
const MIN_SEARCH_LENGTH = 2;

export interface EventListFilters {
  family?: string;
  tag?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

interface EventCursor {
  date: string;
  uid: string;
}

interface UseEventsResult {
  events: Event[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  loadMoreError: string | null;
  loadMoreFuture: () => void;
  loadMorePast: () => void;
  hasMoreFuture: boolean;
  hasMorePast: boolean;
  searchTooShort: boolean;
}

interface UseMonthEventsResult {
  events: Event[];
  loading: boolean;
  error: string | null;
}

/**
 * Loads upcoming events in pages. Older events are deliberately not queried
 * until the user asks for them, keeping the initial payload small.
 */
export function useEvents(filters: EventListFilters = {}): UseEventsResult {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [hasMoreFuture, setHasMoreFuture] = useState(true);
  const [hasMorePast, setHasMorePast] = useState(true);
  const [futureCursor, setFutureCursor] = useState<EventCursor | undefined>();
  const [pastCursor, setPastCursor] = useState<EventCursor | undefined>();
  const requestVersion = useRef(0);

  const { family, tag, search, startDate, endDate } = filters;
  const normalizedSearch = search?.trim().replace(/\s+/g, ' ').slice(0, 100) ?? '';
  const isSearchMode = normalizedSearch.length >= MIN_SEARCH_LENGTH;
  const isSearchTooShort = normalizedSearch.length > 0 && !isSearchMode;
  const loadPage = useCallback(
    async (
      direction: 'future' | 'past' | 'search',
      cursor: EventCursor | undefined,
      version: number,
    ) => {
      const page = await loadEvents({
        family,
        tag,
        search: normalizedSearch || undefined,
        dateFrom: startDate,
        dateToExclusive: endDate ? addOneDay(endDate) : undefined,
        direction: direction === 'search' ? undefined : direction,
        cursor,
        limit: EVENT_PAGE_SIZE,
      });

      if (requestVersion.current !== version) return;

      setEvents((current) => {
        const byId = new Map(current.map((event) => [event.id, event]));
        for (const event of page) byId.set(event.id, event);
        return Array.from(byId.values()).sort(compareEvents);
      });

      if (direction === 'future' || direction === 'search') {
        setHasMoreFuture(page.length === EVENT_PAGE_SIZE);
        if (page.length > 0) setFutureCursor(toCursor(page[page.length - 1]));
      } else {
        setHasMorePast(page.length === EVENT_PAGE_SIZE);
        if (page.length > 0) setPastCursor(toCursor(page[page.length - 1]));
      }
    },
    [endDate, family, normalizedSearch, startDate, tag],
  );

  useEffect(() => {
    const version = ++requestVersion.current;
    setEvents([]);
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    setLoadMoreError(null);
    setHasMoreFuture(!isSearchTooShort);
    setHasMorePast(!isSearchMode && !isSearchTooShort);
    setFutureCursor(undefined);
    setPastCursor(undefined);

    if (isSearchTooShort) {
      setLoading(false);
      return;
    }

    loadPage(isSearchMode ? 'search' : 'future', undefined, version)
      .catch((reason: unknown) => {
        if (requestVersion.current !== version) return;
        setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (requestVersion.current === version) setLoading(false);
      });
  }, [isSearchMode, isSearchTooShort, loadPage]);

  const loadMore = useCallback(
    (direction: 'future' | 'past') => {
      if (isSearchMode && direction === 'past') return;
      if (loadingMore || (direction === 'future' ? !hasMoreFuture : !hasMorePast)) return;
      const version = requestVersion.current;
      const cursor = direction === 'future' ? futureCursor : pastCursor;
      setLoadingMore(true);
      setLoadMoreError(null);
      loadPage(isSearchMode && direction === 'future' ? 'search' : direction, cursor, version)
        .catch((reason: unknown) => {
          if (requestVersion.current === version) {
            setLoadMoreError(reason instanceof Error ? reason.message : String(reason));
          }
        })
        .finally(() => {
          if (requestVersion.current === version) setLoadingMore(false);
        });
    },
    [futureCursor, hasMoreFuture, hasMorePast, isSearchMode, loadingMore, loadPage, pastCursor],
  );
  const loadMoreFuture = useCallback(() => loadMore('future'), [loadMore]);
  const loadMorePast = useCallback(() => loadMore('past'), [loadMore]);

  return {
    events,
    loading,
    loadingMore,
    error,
    loadMoreError,
    loadMoreFuture,
    loadMorePast,
    hasMoreFuture,
    hasMorePast,
    searchTooShort: isSearchTooShort,
  };
}

/** Load only the events that belong to the calendar's currently visible month. */
export function useEventsForMonth(
  month: string,
  filters: Pick<EventListFilters, 'family' | 'tag' | 'search' | 'startDate' | 'endDate'> = {},
): UseMonthEventsResult {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { family, tag, search, startDate, endDate } = filters;
  const normalizedSearch = search?.trim().replace(/\s+/g, ' ').slice(0, 100) ?? '';

  useEffect(() => {
    let cancelled = false;
    const monthStart = `${month}-01`;
    const monthEnd = nextMonth(monthStart);
    const dateFrom = startDate && startDate > monthStart ? startDate : monthStart;
    const endDateExclusive = endDate ? addOneDay(endDate) : monthEnd;
    const dateToExclusive = endDateExclusive < monthEnd ? endDateExclusive : monthEnd;

    setLoading(true);
    setError(null);
    if (normalizedSearch.length === 1) {
      setEvents([]);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    loadEvents({
      family,
      tag,
      search: normalizedSearch || undefined,
      dateFrom,
      dateToExclusive,
    })
      .then((loaded) => {
        if (!cancelled) setEvents(loaded.sort(compareEvents));
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [endDate, family, month, normalizedSearch, startDate, tag]);

  return { events, loading, error };
}

function addOneDay(date: string): string {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + 1);
  return next.toISOString().slice(0, 10);
}

function nextMonth(monthStart: string): string {
  const next = new Date(`${monthStart}T00:00:00`);
  next.setMonth(next.getMonth() + 1);
  return next.toISOString().slice(0, 10);
}

function toCursor(event: Event): EventCursor {
  return { date: event.date, uid: event.id };
}

export function compareEvents(a: Event, b: Event): number {
  const dateDiff = a.date.localeCompare(b.date);
  if (dateDiff !== 0) return dateDiff;

  const tierA = getEventTier(a);
  const tierB = getEventTier(b);
  const tierDiff = tierA - tierB;
  if (tierDiff !== 0) return tierDiff;

  if (tierA === 2) return (a.end_time ?? '').localeCompare(b.end_time ?? '');
  if (tierA === 3) return (a.start_time ?? '').localeCompare(b.start_time ?? '');
  return a.id.localeCompare(b.id);
}

function getEventTier(event: Event): number {
  const hasStart = event.start_time !== null;
  const hasEnd = event.end_time !== null;
  if (!hasStart && !hasEnd) return 1;
  if (!hasStart && hasEnd) return 2;
  return 3;
}
