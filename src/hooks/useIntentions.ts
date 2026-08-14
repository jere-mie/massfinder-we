import { useState, useEffect } from 'react';
import type { MassIntention } from '../types/church';

interface UseIntentionsResult {
  intentions: MassIntention[];
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook to fetch and manage Mass intentions data
 */
export function useIntentions(): UseIntentionsResult {
  const [intentions, setIntentions] = useState<MassIntention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/intentions.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then((data: MassIntention[]) => {
        // Sort by date descending (most recent first), then by time ascending
        const sorted = data.sort((a, b) => {
          const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
          if (dateDiff !== 0) return dateDiff;
          return a.time.localeCompare(b.time);
        });
        setIntentions(sorted);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching intentions data:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { intentions, loading, error };
}
