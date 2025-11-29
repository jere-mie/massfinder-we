import type { Church, Mass, TimeRange, TableRow } from '../types/church';
import { DAYS_ORDER } from './constants';
import { formatTime, formatTimeRange } from './formatting';

/**
 * Filter churches based on mass times
 */
export function filterChurchesByMasses(
  churches: Church[],
  filterDay: string,
  filterAfterTime: string,
  filterBeforeTime: string
): Church[] {
  return churches.filter((church) => {
    const masses = [...church.masses, ...church.daily_masses];
    const filtered = masses.filter((mass) => {
      const timeMatch =
        mass.time >= filterAfterTime && mass.time <= filterBeforeTime;
      const dayMatch = filterDay === 'all' || mass.day === filterDay;
      return timeMatch && dayMatch;
    });
    return filtered.length > 0;
  });
}

/**
 * Filter churches based on time range events (confession or adoration)
 */
export function filterChurchesByTimeRange(
  churches: Church[],
  filterType: 'confession' | 'adoration',
  filterDay: string,
  filterAfterTime: string,
  filterBeforeTime: string
): Church[] {
  return churches.filter((church) => {
    const items = church[filterType];
    const filtered = items.filter((item) => {
      const timeMatch =
        (item.start >= filterAfterTime && item.start <= filterBeforeTime) ||
        (item.end >= filterAfterTime && item.end <= filterBeforeTime);
      const dayMatch = filterDay === 'all' || item.day === filterDay;
      return timeMatch && dayMatch;
    });
    return filtered.length > 0;
  });
}

/**
 * Get filtered churches based on filter type
 */
export function getFilteredChurches(
  churches: Church[],
  filterType: 'masses' | 'confession' | 'adoration',
  filterDay: string,
  filterAfterTime: string,
  filterBeforeTime: string
): Church[] {
  if (filterType === 'masses') {
    return filterChurchesByMasses(
      churches,
      filterDay,
      filterAfterTime,
      filterBeforeTime
    );
  }
  return filterChurchesByTimeRange(
    churches,
    filterType,
    filterDay,
    filterAfterTime,
    filterBeforeTime
  );
}

/**
 * Sort masses by day and time
 */
export function sortMasses(masses: Mass[]): Mass[] {
  return [...masses].sort((a, b) => {
    const dayComparison =
      DAYS_ORDER.indexOf(a.day as (typeof DAYS_ORDER)[number]) -
      DAYS_ORDER.indexOf(b.day as (typeof DAYS_ORDER)[number]);
    return dayComparison !== 0 ? dayComparison : a.time.localeCompare(b.time);
  });
}

/**
 * Sort time ranges by day and start time
 */
export function sortTimeRanges(items: TimeRange[]): TimeRange[] {
  return [...items].sort((a, b) => {
    const dayComparison =
      DAYS_ORDER.indexOf(a.day as (typeof DAYS_ORDER)[number]) -
      DAYS_ORDER.indexOf(b.day as (typeof DAYS_ORDER)[number]);
    return dayComparison !== 0 ? dayComparison : a.start.localeCompare(b.start);
  });
}

/**
 * Convert masses to table rows
 */
export function massesToTableRows(churches: Church[], type: 'masses' | 'daily_masses'): TableRow[] {
  const rows = churches.flatMap((church) =>
    church[type].map((mass) => ({
      name: church.name,
      address: church.address,
      day: mass.day,
      time: formatTime(mass.time),
      rawTime: mass.time,
      note: mass.note,
    }))
  );

  // Sort by day and time
  return rows.sort((a, b) => {
    const dayComp =
      DAYS_ORDER.indexOf(a.day as (typeof DAYS_ORDER)[number]) -
      DAYS_ORDER.indexOf(b.day as (typeof DAYS_ORDER)[number]);
    return dayComp !== 0 ? dayComp : (a.rawTime || '').localeCompare(b.rawTime || '');
  });
}

/**
 * Convert time ranges to table rows
 */
export function timeRangesToTableRows(
  churches: Church[],
  type: 'confession' | 'adoration'
): TableRow[] {
  const rows = churches.flatMap((church) =>
    church[type].map((item) => ({
      name: church.name,
      address: church.address,
      day: item.day,
      time: formatTimeRange(item.start, item.end),
      start: item.start,
      note: item.note,
    }))
  );

  // Sort by day and start time
  return rows.sort((a, b) => {
    const dayComp =
      DAYS_ORDER.indexOf(a.day as (typeof DAYS_ORDER)[number]) -
      DAYS_ORDER.indexOf(b.day as (typeof DAYS_ORDER)[number]);
    return dayComp !== 0 ? dayComp : (a.start || '').localeCompare(b.start || '');
  });
}

/**
 * Filter table rows by day
 */
export function filterRowsByDay(rows: TableRow[], selectedDay: string): TableRow[] {
  if (selectedDay === 'all') return rows;
  return rows.filter((row) => row.day === selectedDay);
}
