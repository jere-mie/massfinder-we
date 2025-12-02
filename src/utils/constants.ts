/**
 * Days of the week in order (starting with Sunday to match JS Date.getDay())
 */
export const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/**
 * Days of the week starting with Monday (for sorting)
 */
export const DAYS_ORDER = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

/**
 * Time options for filter dropdowns (24-hour format values with 12-hour labels)
 */
export const TIME_OPTIONS = [
  { value: '0000', label: '12am' },
  { value: '0100', label: '1am' },
  { value: '0200', label: '2am' },
  { value: '0300', label: '3am' },
  { value: '0400', label: '4am' },
  { value: '0500', label: '5am' },
  { value: '0600', label: '6am' },
  { value: '0700', label: '7am' },
  { value: '0800', label: '8am' },
  { value: '0900', label: '9am' },
  { value: '1000', label: '10am' },
  { value: '1100', label: '11am' },
  { value: '1200', label: '12pm' },
  { value: '1300', label: '1pm' },
  { value: '1400', label: '2pm' },
  { value: '1500', label: '3pm' },
  { value: '1600', label: '4pm' },
  { value: '1700', label: '5pm' },
  { value: '1800', label: '6pm' },
  { value: '1900', label: '7pm' },
  { value: '2000', label: '8pm' },
  { value: '2100', label: '9pm' },
  { value: '2200', label: '10pm' },
  { value: '2300', label: '11pm' },
] as const;

/**
 * Section options for list view filtering
 */
export const SECTION_OPTIONS = [
  { value: 'all', label: 'All Sections' },
  { value: 'mass-times', label: 'Mass Times' },
  { value: 'daily-masses', label: 'Daily Masses' },
  { value: 'confession-times', label: 'Confession Times' },
  { value: 'adoration-times', label: 'Adoration Times' },
] as const;

/**
 * Default map center (Windsor-Essex County)
 */
export const MAP_CENTER: [number, number] = [42.16132298808876, -82.92932437200604];

/**
 * Default map zoom level
 */
export const MAP_ZOOM = 11;

/**
 * Map zoom constraints
 */
export const MAP_MIN_ZOOM = 9;
export const MAP_MAX_ZOOM = 19;
