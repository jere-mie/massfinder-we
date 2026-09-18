import { useCallback, useEffect, useRef, useState } from 'react';
import type { MassIntention } from '../types/church';
import { loadIntentions } from '../lib/databaseClient';

const INTENTION_PAGE_SIZE = 32;
const MIN_SEARCH_LENGTH = 2;

export interface IntentionListFilters {
  churchId?: string;
  search?: string;
}

interface IntentionCursor {
  date: string;
  uid: string;
}

interface UseIntentionsResult {
  intentions: MassIntention[];
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

/**
 * Loads upcoming Mass intentions in pages and defers historical records until
 * the user requests them with the load-older control.
 */
export function useIntentions(filters: IntentionListFilters = {}): UseIntentionsResult {
  const [intentions, setIntentions] = useState<MassIntention[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [hasMoreFuture, setHasMoreFuture] = useState(true);
  const [hasMorePast, setHasMorePast] = useState(true);
  const [futureCursor, setFutureCursor] = useState<IntentionCursor | undefined>();
  const [pastCursor, setPastCursor] = useState<IntentionCursor | undefined>();
  const requestVersion = useRef(0);

  const { churchId, search } = filters;
  const normalizedSearch = search?.trim().replace(/\s+/g, ' ').slice(0, 100) ?? '';
  const isSearchMode = normalizedSearch.length >= MIN_SEARCH_LENGTH;
  const isSearchTooShort = normalizedSearch.length > 0 && !isSearchMode;
  const loadPage = useCallback(
    async (
      direction: 'future' | 'past' | 'search',
      cursor: IntentionCursor | undefined,
      version: number,
    ) => {
      const page = await loadIntentions({
        churchId,
        search: normalizedSearch || undefined,
        direction: direction === 'search' ? undefined : direction,
        cursor,
        limit: INTENTION_PAGE_SIZE,
      });

      if (requestVersion.current !== version) return;

      setIntentions((current) => {
        const byUid = new Map(current.map((intention) => [intention.uid, intention]));
        for (const intention of page) byUid.set(intention.uid, intention);
        return Array.from(byUid.values()).sort(compareIntentions);
      });

      if (direction === 'future' || direction === 'search') {
        setHasMoreFuture(page.length === INTENTION_PAGE_SIZE);
        if (page.length > 0) setFutureCursor(toCursor(page[page.length - 1]));
      } else {
        setHasMorePast(page.length === INTENTION_PAGE_SIZE);
        if (page.length > 0) setPastCursor(toCursor(page[page.length - 1]));
      }
    },
    [churchId, normalizedSearch],
  );

  useEffect(() => {
    const version = ++requestVersion.current;
    setIntentions([]);
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
    intentions,
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

function toCursor(intention: MassIntention): IntentionCursor {
  return { date: intention.date, uid: intention.uid };
}

function compareIntentions(a: MassIntention, b: MassIntention): number {
  const dateDiff = a.date.localeCompare(b.date);
  if (dateDiff !== 0) return dateDiff;
  const timeDiff = a.time.localeCompare(b.time);
  return timeDiff || a.uid.localeCompare(b.uid);
}
