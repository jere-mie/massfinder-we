import { useEffect, useState } from 'react';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const update = () => setMatches(mediaQuery.matches);
    update();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', update);
      return () => mediaQuery.removeEventListener('change', update);
    }

    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, [query]);

  return matches;
}

/** Keep responsive calendar behavior in sync with the CSS breakpoint. */
export function useIsMobile(maxWidth = 639): boolean {
  return useMediaQuery(`(max-width: ${maxWidth}px)`);
}

/** Treat 1920px and wider displays as extra-large calendar layouts. */
export function useIsExtraLarge(minWidth = 1920): boolean {
  return useMediaQuery(`(min-width: ${minWidth}px)`);
}
