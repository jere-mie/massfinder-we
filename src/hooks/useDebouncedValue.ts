import { useEffect, useState } from 'react';

/**
 * Prevents a synchronous SQLite query from running for every keystroke in a
 * text filter while keeping the input itself immediately responsive.
 */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}
