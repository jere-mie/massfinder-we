/**
 * Represents a single Mass time
 */
export interface Mass {
  day: string;
  time: string; // 24-hour format: "HHMM" (e.g., "1830" for 6:30 PM)
  note?: string;
  dayOfMonth?: number;
}

/**
 * Represents a time range (used for confession and adoration)
 */
export interface TimeRange {
  day: string;
  start: string; // 24-hour format: "HHMM"
  end: string; // 24-hour format: "HHMM"
  note?: string;
  dayOfMonth?: number;
}

/**
 * Represents one parish or family-of-parishes office.
 */
export interface Office {
  building?: string;
  address: string;
  phone?: string; // Format: "+15551234567"
  email?: string;
  hours: TimeRange[];
}

/**
 * Represents a Catholic church with all its schedule information
 */
export interface Church {
  id: string; // Text UID (e.g., "st-john-the-baptist-amherstburg")
  name: string;
  familyOfParishes?: string; // The family of parishes this church belongs to
  address: string;
  coordinates: [number, number]; // [latitude, longitude]
  map: string; // Google Maps link
  website: string;
  hidden?: boolean; // If true, exclude this church from displays
  bulletin_website?: string;
  phone: string; // Format: "+15551234567"
  offices: Office[];
  masses: Mass[];
  daily_masses: Mass[];
  confession: TimeRange[];
  adoration: TimeRange[];
}

/**
 * Filter types for the map view
 */
export type FilterType = 'masses' | 'confession' | 'adoration';

/**
 * Filter state for map filtering
 */
export interface MapFilters {
  filterType: FilterType;
  filterDay: string; // 'all' or day name
  filterAfterTime: string; // 24-hour format
  filterBeforeTime: string; // 24-hour format
}

/**
 * Filter state for list filtering
 */
export interface ListFilters {
  selectedDay: string; // 'all' or day name
  selectedSection: string; // 'all' or section name
}

/**
 * Row data for list tables
 */
export interface TableRow {
  id: string; // Church unique identifier
  name: string;
  address: string;
  day: string;
  time: string;
  rawTime?: string; // For sorting
  start?: string; // For time range sorting
  note?: string;
}

/**
 * Tab types
 */
export type TabType = 'map' | 'list' | 'calendar';

/**
 * Valid tag categories for parish events
 */
export type EventTag =
  | 'devotion'
  | 'faith_formation'
  | 'fundraiser'
  | 'liturgy'
  | 'meeting'
  | 'music_arts'
  | 'outreach'
  | 'retreat'
  | 'sacramental'
  | 'seasonal'
  | 'social'
  | 'volunteer'
  | 'other';

/** All valid event tags as a runtime constant, ordered alphabetically. */
export const ALL_EVENT_TAGS: EventTag[] = [
  'devotion',
  'faith_formation',
  'fundraiser',
  'liturgy',
  'meeting',
  'music_arts',
  'outreach',
  'retreat',
  'sacramental',
  'seasonal',
  'social',
  'volunteer',
  'other',
];

/**
 * Represents a parish event extracted from bulletins
 */
export interface Event {
  id: string; // Text UID (8-char base36 for legacy event records)
  title: string;
  description: string;
  church_id: string | null; // null for family-wide events
  church_name: string | null;
  family_of_parishes: string;
  date: string; // YYYY-MM-DD
  start_time: string | null; // HHMM
  end_time: string | null; // HHMM
  location: string | null;
  tags: EventTag[];
  source_bulletin_link: string;
  source_bulletin_date: string;
  extracted_at: string; // ISO timestamp
}

/**
 * Represents a single intention within a Mass
 */
export interface Intention {
  for: string; // The person or cause the intention is for
  by: string | null; // Who requested the intention, or null if not specified
}

/**
 * Represents a Mass (daily or weekly) with its intentions
 */
export interface MassIntention {
  uid: string; // Text UID for the mass-intention record
  church_id: string; // ID of the church (e.g., "holy-trinity-windsor")
  date: string; // YYYY-MM-DD
  time: string; // HHMM 24-hour format
  intentions: Intention[];
  source_bulletin_link: string;
  extracted_at: string; // ISO timestamp
}

/**
 * SQLite stores scalar values only. These row types document the normalized
 * database representation; databaseQueries.ts assembles them into the UI
 * shapes above after reading the database.
 */
export type SQLiteValue = string | number | null;

export interface SQLiteChurchRow {
  uid: string;
  name: string;
  family_of_parishes: string | null;
  address: string;
  latitude: number;
  longitude: number;
  map_url: string;
  website: string;
  hidden: 0 | 1;
  bulletin_website: string | null;
  phone: string;
}

export interface SQLiteScheduleRow {
  uid: string;
  church_uid: string;
  schedule_type: 'regular' | 'daily';
  day: string;
  time: string;
  note: string | null;
  day_of_month: number | null;
}

export interface SQLiteTimeRangeRow {
  uid: string;
  church_uid: string;
  range_type: 'confession' | 'adoration';
  day: string;
  start_time: string;
  end_time: string;
  note: string | null;
  day_of_month: number | null;
}

export interface SQLiteOfficeRow {
  uid: string;
  church_uid: string;
  building: string | null;
  address: string;
  phone: string | null;
  email: string | null;
}

export interface SQLiteOfficeHourRow {
  uid: string;
  office_uid: string;
  day: string;
  start_time: string;
  end_time: string;
  note: string | null;
  day_of_month: number | null;
}

export interface SQLiteEventRow {
  uid: string;
  title: string;
  description: string;
  church_uid: string | null;
  church_name: string | null;
  family_of_parishes: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  source_bulletin_link: string;
  source_bulletin_date: string;
  extracted_at: string;
}

export interface SQLiteEventTagRow {
  uid: string;
  event_uid: string;
  tag: string;
}

export interface SQLiteMassIntentionRow {
  uid: string;
  church_uid: string;
  mass_date: string;
  mass_time: string;
  source_bulletin_link: string;
  extracted_at: string;
}

export interface SQLiteIntentionEntryRow {
  uid: string;
  mass_intention_uid: string;
  intention_for: string;
  requested_by: string | null;
}
