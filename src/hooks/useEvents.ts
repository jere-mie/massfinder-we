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
        // Sort events by date (ascending)
        const sortedEvents = data.sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
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
