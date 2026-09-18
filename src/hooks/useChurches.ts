import { useState, useEffect } from 'react';
import type { Church } from '../types/church';
import { loadChurches } from '../lib/databaseClient';

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
    let cancelled = false;
    loadChurches()
      .then((data: Church[]) => {
        if (cancelled) return;
        // Exclude churches explicitly marked as hidden
        const visible = Array.isArray(data) ? data.filter((c) => !c.hidden) : [];
        setChurches(visible);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Error loading Church data from SQLite:', err);
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { churches, loading, error };
}
