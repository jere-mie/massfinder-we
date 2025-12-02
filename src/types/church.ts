/**
 * Represents a single Mass time
 */
export interface Mass {
  day: string;
  time: string; // 24-hour format: "HHMM" (e.g., "1830" for 6:30 PM)
  note?: string;
}

/**
 * Represents a time range (used for confession and adoration)
 */
export interface TimeRange {
  day: string;
  start: string; // 24-hour format: "HHMM"
  end: string; // 24-hour format: "HHMM"
  note?: string;
}

/**
 * Represents a Catholic church with all its schedule information
 */
export interface Church {
  id: string; // Unique identifier (e.g., "st-john-the-baptist-amherstburg")
  name: string;
  familyOfParishes?: string; // The family of parishes this church belongs to
  address: string;
  coordinates: [number, number]; // [latitude, longitude]
  map: string; // Google Maps link
  website: string;
  bulletin_website?: string;
  phone: string; // Format: "+15551234567"
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
export type TabType = 'map' | 'list';

/**
 * Represents a parish event extracted from bulletins
 */
export interface Event {
  id: string; // 8-char base36
  title: string;
  description: string;
  church_id: string | null; // null for family-wide events
  church_name: string | null;
  family_of_parishes: string;
  date: string; // YYYY-MM-DD
  start_time: string | null; // HHMM
  end_time: string | null; // HHMM
  location: string | null;
  tags: string[];
  source_bulletin_link: string;
  source_bulletin_date: string;
  extracted_at: string; // ISO timestamp
}
