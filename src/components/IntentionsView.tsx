import { useState, useMemo } from 'react';
import { useIntentions } from '../hooks/useIntentions';
import { useChurches } from '../hooks/useChurches';
import { formatTime } from '../utils/formatting';
import type { MassIntention } from '../types/church';

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
 * Check if a date is in the past
 */
function isDatePast(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(dateStr + 'T00:00:00');
  return eventDate < today;
}

/**
 * Flatten intentions for searching: produces one row per intention
 */
interface FlatIntention {
  churchId: string;
  churchName: string;
  date: string;
  time: string;
  intentionFor: string;
  intentionBy: string | null;
  isPast: boolean;
}

function flattenIntentions(
  intentions: MassIntention[],
  churchMap: Map<string, string>,
): FlatIntention[] {
  const flat: FlatIntention[] = [];
  for (const mass of intentions) {
    const churchName = churchMap.get(mass.church_id) || mass.church_id;
    const isPast = isDatePast(mass.date);
    for (const intention of mass.intentions) {
      flat.push({
        churchId: mass.church_id,
        churchName,
        date: mass.date,
        time: mass.time,
        intentionFor: intention.for,
        intentionBy: intention.by,
        isPast,
      });
    }
  }
  return flat;
}

/**
 * IntentionsView - searchable view of Mass intentions
 */
export function IntentionsView() {
  const { intentions, loading, error } = useIntentions();
  const { churches, loading: churchesLoading } = useChurches();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChurch, setSelectedChurch] = useState('all');
  const [hidePast, setHidePast] = useState(true);

  // Build church id -> name map
  const churchMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of churches) {
      map.set(c.id, c.name);
    }
    return map;
  }, [churches]);

  // Get unique church IDs that have intentions
  const churchOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const mass of intentions) {
      ids.add(mass.church_id);
    }
    return Array.from(ids).sort((a, b) => {
      const nameA = churchMap.get(a) || a;
      const nameB = churchMap.get(b) || b;
      return nameA.localeCompare(nameB);
    });
  }, [intentions, churchMap]);

  // Flatten and filter intentions
  const filteredIntentions = useMemo(() => {
    let flat = flattenIntentions(intentions, churchMap);

    // Filter by church
    if (selectedChurch !== 'all') {
      flat = flat.filter((i) => i.churchId === selectedChurch);
    }

    // Filter past
    if (hidePast) {
      flat = flat.filter((i) => !i.isPast);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      flat = flat.filter(
        (i) =>
          i.intentionFor.toLowerCase().includes(q) ||
          (i.intentionBy && i.intentionBy.toLowerCase().includes(q)) ||
          i.churchName.toLowerCase().includes(q),
      );
    }

    // Sort: upcoming first (by date asc, then time asc)
    flat.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a.time.localeCompare(b.time);
    });

    return flat;
  }, [intentions, churchMap, searchQuery, selectedChurch, hidePast]);

  if (loading || churchesLoading) {
    return (
      <div className="container mx-auto px-4 text-center my-12">
        <div
          className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"
          role="status"
        >
          <span className="sr-only">Loading...</span>
        </div>
        <p className="mt-4 text-gray-600" aria-live="polite">
          Loading Mass intentions...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 text-center my-12">
        <div
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg"
          role="alert"
          aria-live="assertive"
        >
          <h2 className="text-lg font-semibold mb-2">Error Loading Data</h2>
          <p>Error loading intentions data: {error}</p>
        </div>
      </div>
    );
  }

  if (intentions.length === 0) {
    return (
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center my-12">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            Mass Intentions
          </h1>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.331 0 4.472.89 6.075 2.356M12 6.042c1.61-1.436 3.698-2.292 6-2.292 1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18c-2.331 0-4.472.89-6.075 2.356M12 6.042V20.356"
              />
            </svg>
            <p className="text-gray-500 text-lg">
              No Mass intentions have been extracted yet.
            </p>
            <p className="text-gray-400 mt-2 text-sm">
              Mass intentions are extracted from parish bulletins and will appear here once available.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 max-w-5xl">
      <div className="text-center my-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
          Mass Intentions
        </h1>
        <p className="text-gray-500 text-sm">
          Search for a name or intention across all parishes
        </p>
      </div>

      {/* Search and filter controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search input */}
          <div className="flex-1">
            <label htmlFor="intention-search" className="sr-only">
              Search intentions
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
              </div>
              <input
                id="intention-search"
                type="text"
                placeholder="Search by name, intention, or parish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Church filter */}
          <div className="md:w-64">
            <label htmlFor="church-filter" className="sr-only">
              Filter by parish
            </label>
            <select
              id="church-filter"
              value={selectedChurch}
              onChange={(e) => setSelectedChurch(e.target.value)}
              className="block w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Parishes</option>
              {churchOptions.map((id) => (
                <option key={id} value={id}>
                  {churchMap.get(id) || id}
                </option>
              ))}
            </select>
          </div>

          {/* Hide past toggle */}
          <div className="flex items-center">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hidePast}
                onChange={(e) => setHidePast(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Hide past
            </label>
          </div>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500 mb-4">
        {filteredIntentions.length === 0
          ? 'No intentions match your search'
          : `Showing ${filteredIntentions.length} intention${filteredIntentions.length !== 1 ? 's' : ''}`}
      </p>

      {/* Results table */}
      {filteredIntentions.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Date & Time
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Parish
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Intention For
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Requested By
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredIntentions.map((item, index) => (
                  <tr
                    key={`${item.churchId}-${item.date}-${item.time}-${index}`}
                    className={`hover:bg-gray-50 ${item.isPast ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      <div>{formatDate(item.date)}</div>
                      <div className="text-gray-500">{formatTime(item.time)}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                      <a
                        href={`/church/${item.churchId}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {item.churchName}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.intentionFor}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {item.intentionBy || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
