import { useState, useEffect } from 'react';
import type { Church } from '../types/church';

interface UseChurchesResult {
  churches: Church[];
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook to fetch and manage church data
 */
export function useChurches(): UseChurchesResult {
  const [churches, setChurches] = useState<Church[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/churches.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then((data: Church[]) => {
        setChurches(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching Church data:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { churches, loading, error };
}
