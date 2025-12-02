import { useState, useEffect } from 'react';
import type { Event } from '../types/church';

interface UseEventsResult {
  events: Event[];
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook to fetch and manage events data
 */
export function useEvents(): UseEventsResult {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/events.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then((data: Event[]) => {
        const sortedEvents = data.sort(compareEvents);
        setEvents(sortedEvents);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching events data:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { events, loading, error };
}

function compareEvents(a: Event, b: Event): number {
  // First: sort by date ascending.
  const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
  if (dateDiff !== 0) return dateDiff;

  // Categorize by event type.
  const tierA = getEventTier(a);
  const tierB = getEventTier(b);

  if (tierA !== tierB) return tierA - tierB;

  // If same tier, sort within tiers
  switch (tierA) {
    case 1:
      // Tier 1: All-day event.
      return 0;
    case 2:
      // Tier 2: Sort by earliest end_time.
      return (a.end_time ?? '').localeCompare(b.end_time ?? '');
    case 3:
      // Tier 3: Sort by earliest start_time.
      return (a.start_time ?? '').localeCompare(b.start_time ?? '');
    default:
      return 0;
  }
}

/**
 * Determine tier based on time fields.
 *
 * Tier 1: start=null & end=null  
 * Tier 2: start=null & end!=null  
 * Tier 3: start!=null (merged tier 3 & 4)
 */
function getEventTier(e: Event): number {
  const hasStart = e.start_time !== null;
  const hasEnd = e.end_time !== null;

  if (!hasStart && !hasEnd) return 1;
  if (!hasStart && hasEnd) return 2;
  return 3;
}