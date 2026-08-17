/**
 * Format a phone number to (xxx) xxx-xxxx format
 * @param phoneNumber - Raw phone number string (may contain non-digits)
 * @returns Formatted phone number in (xxx) xxx-xxxx format
 * @example formatPhoneNumber("+15197365418") // Returns: "(519) 736-5418"
 */
export function formatPhoneNumber(phoneNumber: string): string {
  return phoneNumber
    .replace(/\D/g, '')
    .replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '($2) $3-$4');
}

/**
 * Format a URL by removing protocol and trailing slash
 * @param url - Full URL including protocol
 * @returns Domain and path without protocol or trailing slash
 * @example formatUrl("https://www.example.com/") // Returns: "www.example.com"
 */
export function formatUrl(url: string): string {
  return url.replace(/^(https?:\/\/)?/i, '').replace(/\/$/, '');
}

/**
 * Format time from 24-hour format (e.g., "1830") to 12-hour format (e.g., "6:30 PM")
 * @param time - Time string in 24-hour format (HHMM)
 * @returns Formatted time in 12-hour format with AM/PM
 * @example formatTime("1830") // Returns: "6:30 PM"
 * @example formatTime("0900") // Returns: "9:00 AM"
 */
export function formatTime(time: string): string {
  const hours = parseInt(time.slice(0, 2), 10);
  const minutes = time.slice(2);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formattedHours = hours % 12 || 12;
  return `${formattedHours}:${minutes} ${ampm}`;
}

/**
 * Format a time range (e.g., "9:00 AM - 10:30 AM")
 * @param start - Start time in 24-hour format (HHMM)
 * @param end - End time in 24-hour format (HHMM)
 * @returns Formatted time range string
 */
export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

/**
 * Group office ranges by day for compact display while preserving their order.
 */
export function groupOfficeHours(hours: TimeRange[]): Array<{ day: string; ranges: TimeRange[] }> {
  const grouped = new Map<string, TimeRange[]>();

  for (const range of hours) {
    const dayRanges = grouped.get(range.day) ?? [];
    dayRanges.push(range);
    grouped.set(range.day, dayRanges);
  }

  return Array.from(grouped, ([day, ranges]) => ({ day, ranges }));
}

/**
 * Format all opening ranges for a day on one line.
 */
export function formatOfficeHours(day: string, ranges: TimeRange[]): string {
  return `${day}: ${ranges.map((range) => formatTimeRange(range.start, range.end)).join(', ')}`;
}

/**
 * Get the current day of the week
 * @returns Full day name (e.g., "Monday", "Tuesday")
 */
export function getCurrentDay(): string {
  const daysOfWeek = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  return daysOfWeek[new Date().getDay()];
}
import type { TimeRange } from '../types/church';
