import type { Database, SqlValue } from 'sql.js';
import type { Church, Event, MassIntention, Office, TimeRange } from '../types/church';

type Row = Record<string, SqlValue>;
const SQLITE_PARAMETER_BATCH_SIZE = 500;
const MAX_SEARCH_LENGTH = 100;

export interface EventQueryFilters {
  family?: string;
  tag?: string;
  search?: string;
  dateFrom?: string;
  dateToExclusive?: string;
  direction?: 'future' | 'past';
  today?: string;
  cursor?: { date: string; uid: string };
  limit?: number;
}

export interface IntentionQueryFilters {
  churchId?: string;
  search?: string;
  dateFrom?: string;
  dateToExclusive?: string;
  direction?: 'future' | 'past';
  today?: string;
  cursor?: { date: string; uid: string };
  limit?: number;
}

function rows(database: Database, sql: string, parameters?: SqlValue[]): Row[] {
  const result = database.exec(sql, parameters);
  if (result.length === 0) return [];

  const [query] = result;
  return query.values.map((values) =>
    Object.fromEntries(query.columns.map((column, index) => [column, values[index]])),
  );
}

function stringValue(value: SqlValue): string {
  return value === null ? '' : String(value);
}

function nullableString(value: SqlValue): string | null {
  return value === null ? null : String(value);
}

function numberValue(value: SqlValue): number {
  return Number(value);
}

function nullableNumber(value: SqlValue): number | undefined {
  return value === null ? undefined : Number(value);
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const groupKey = key(item);
    const group = grouped.get(groupKey) ?? [];
    group.push(item);
    grouped.set(groupKey, group);
  }
  return grouped;
}

function batches<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function todayIsoDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizedSearchTerm(search: string | undefined): string | undefined {
  const normalized = search?.trim().replace(/\s+/g, ' ').slice(0, MAX_SEARCH_LENGTH);
  return normalized || undefined;
}

function searchPattern(search: string | undefined): string | undefined {
  const normalized = normalizedSearchTerm(search);
  if (!normalized) return undefined;

  // Treat user input as a literal substring rather than allowing `%` and `_`
  // to become unbounded LIKE wildcards. The value remains parameterized.
  const escaped = normalized.toLowerCase().replace(/[\\%_]/g, (character) => `\\${character}`);
  return `%${escaped}%`;
}

function valueMatchesSearch(value: string | null, search: string | undefined): boolean {
  return Boolean(search && value?.toLowerCase().includes(search.toLowerCase()));
}

export function queryChurches(database: Database): Church[] {
  const churchRows = rows(database, 'SELECT * FROM churches ORDER BY uid');
  const scheduleRows = rows(database, 'SELECT * FROM mass_schedules ORDER BY uid');
  const rangeRows = rows(database, 'SELECT * FROM time_ranges ORDER BY uid');
  const officeRows = rows(database, 'SELECT * FROM offices ORDER BY uid');
  const officeHourRows = rows(database, 'SELECT * FROM office_hours ORDER BY uid');
  const schedulesByChurch = groupBy(scheduleRows, (row) => stringValue(row.church_uid));
  const rangesByChurch = groupBy(rangeRows, (row) => stringValue(row.church_uid));
  const officesByChurch = groupBy(officeRows, (row) => stringValue(row.church_uid));
  const hoursByOffice = groupBy(officeHourRows, (row) => stringValue(row.office_uid));

  return churchRows.map((row) => {
    const uid = stringValue(row.uid);
    const schedules = schedulesByChurch.get(uid) ?? [];
    const timeRanges = rangesByChurch.get(uid) ?? [];
    const offices: Office[] = (officesByChurch.get(uid) ?? []).map((officeRow) => ({
      building: nullableString(officeRow.building) ?? undefined,
      address: stringValue(officeRow.address),
      phone: nullableString(officeRow.phone) ?? undefined,
      email: nullableString(officeRow.email) ?? undefined,
      hours: (hoursByOffice.get(stringValue(officeRow.uid)) ?? []).map((hour) => ({
        day: stringValue(hour.day),
        start: stringValue(hour.start_time),
        end: stringValue(hour.end_time),
        note: nullableString(hour.note) ?? undefined,
        dayOfMonth: nullableNumber(hour.day_of_month),
      })),
    }));

    const mapTimeRange = (range: Row): TimeRange => ({
      day: stringValue(range.day),
      start: stringValue(range.start_time),
      end: stringValue(range.end_time),
      note: nullableString(range.note) ?? undefined,
      dayOfMonth: nullableNumber(range.day_of_month),
    });

    return {
      id: uid,
      name: stringValue(row.name),
      familyOfParishes: nullableString(row.family_of_parishes) ?? undefined,
      address: stringValue(row.address),
      coordinates: [numberValue(row.latitude), numberValue(row.longitude)],
      map: stringValue(row.map_url),
      website: stringValue(row.website),
      hidden: Boolean(numberValue(row.hidden)),
      bulletin_website: nullableString(row.bulletin_website) ?? undefined,
      phone: stringValue(row.phone),
      offices,
      masses: schedules
        .filter((schedule) => schedule.schedule_type === 'regular')
        .map((schedule) => ({
          day: stringValue(schedule.day),
          time: stringValue(schedule.time),
          note: nullableString(schedule.note) ?? undefined,
          dayOfMonth: nullableNumber(schedule.day_of_month),
        })),
      daily_masses: schedules
        .filter((schedule) => schedule.schedule_type === 'daily')
        .map((schedule) => ({
          day: stringValue(schedule.day),
          time: stringValue(schedule.time),
          note: nullableString(schedule.note) ?? undefined,
          dayOfMonth: nullableNumber(schedule.day_of_month),
        })),
      confession: timeRanges
        .filter((range) => range.range_type === 'confession')
        .map(mapTimeRange),
      adoration: timeRanges
        .filter((range) => range.range_type === 'adoration')
        .map(mapTimeRange),
    };
  });
}

export function queryEvents(database: Database, filters: EventQueryFilters = {}): Event[] {
  const conditions: string[] = [];
  const parameters: SqlValue[] = [];

  if (filters.family) {
    conditions.push('e.family_of_parishes = ?');
    parameters.push(filters.family);
  }
  if (filters.tag) {
    conditions.push('EXISTS (SELECT 1 FROM event_tags filter_tags WHERE filter_tags.event_uid = e.uid AND filter_tags.tag = ?)');
    parameters.push(filters.tag);
  }
  const eventSearchPattern = searchPattern(filters.search);
  if (eventSearchPattern) {
    conditions.push(`(
      LOWER(e.title) LIKE ? ESCAPE '\\' OR
      LOWER(COALESCE(e.description, '')) LIKE ? ESCAPE '\\' OR
      LOWER(COALESCE(e.church_name, '')) LIKE ? ESCAPE '\\' OR
      LOWER(COALESCE(e.family_of_parishes, '')) LIKE ? ESCAPE '\\' OR
      LOWER(COALESCE(e.location, '')) LIKE ? ESCAPE '\\'
    )`);
    parameters.push(
      eventSearchPattern,
      eventSearchPattern,
      eventSearchPattern,
      eventSearchPattern,
      eventSearchPattern,
    );
  }
  if (filters.dateFrom) {
    conditions.push('e.event_date >= ?');
    parameters.push(filters.dateFrom);
  }
  if (filters.dateToExclusive) {
    conditions.push('e.event_date < ?');
    parameters.push(filters.dateToExclusive);
  }
  if (filters.direction === 'future') {
    const today = filters.today ?? todayIsoDate();
    conditions.push('e.event_date >= ?');
    parameters.push(today);
  } else if (filters.direction === 'past') {
    const today = filters.today ?? todayIsoDate();
    conditions.push('e.event_date < ?');
    parameters.push(today);
  }
  if (filters.cursor) {
    const comparator = filters.direction === 'past' ? '<' : '>';
    conditions.push(`(e.event_date ${comparator} ? OR (e.event_date = ? AND e.uid ${comparator} ?))`);
    parameters.push(filters.cursor.date, filters.cursor.date, filters.cursor.uid);
  }

  const direction = filters.direction === 'past' ? 'DESC' : 'ASC';
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit == null ? '' : ' LIMIT ?';
  if (filters.limit != null) parameters.push(filters.limit);

  const eventRows = rows(
    database,
    `SELECT e.* FROM events e ${where} ORDER BY e.event_date ${direction}, e.uid ${direction}${limit}`,
    parameters,
  );
  const eventUids = eventRows.map((event) => stringValue(event.uid));
  const eventTagRows = eventUids.length === 0
    ? []
    : batches(eventUids, SQLITE_PARAMETER_BATCH_SIZE).flatMap((batch) =>
        rows(
          database,
          `SELECT event_uid, tag FROM event_tags WHERE event_uid IN (${batch.map(() => '?').join(',')}) ORDER BY event_uid, tag`,
          batch,
        ),
      );
  const tagsByEvent = groupBy(eventTagRows, (row) => stringValue(row.event_uid));

  return eventRows.map((row) => ({
    id: stringValue(row.uid),
    title: stringValue(row.title),
    description: stringValue(row.description),
    church_id: nullableString(row.church_uid),
    church_name: nullableString(row.church_name),
    family_of_parishes: stringValue(row.family_of_parishes),
    date: stringValue(row.event_date),
    start_time: nullableString(row.start_time),
    end_time: nullableString(row.end_time),
    location: nullableString(row.location),
    tags: (tagsByEvent.get(stringValue(row.uid)) ?? []).map((tag) => stringValue(tag.tag)) as Event['tags'],
    source_bulletin_link: stringValue(row.source_bulletin_link),
    source_bulletin_date: stringValue(row.source_bulletin_date),
    extracted_at: stringValue(row.extracted_at),
  }));
}

export function queryIntentions(database: Database, filters: IntentionQueryFilters = {}): MassIntention[] {
  const conditions: string[] = [];
  const parameters: SqlValue[] = [];

  if (filters.churchId) {
    conditions.push('m.church_uid = ?');
    parameters.push(filters.churchId);
  }
  const intentionSearchPattern = searchPattern(filters.search);
  const intentionSearchTerm = normalizedSearchTerm(filters.search);
  if (intentionSearchPattern) {
    conditions.push(`(
      LOWER(c.name) LIKE ? ESCAPE '\\' OR
      EXISTS (
        SELECT 1 FROM intention_entries search_entries
        WHERE search_entries.mass_intention_uid = m.uid
          AND (LOWER(search_entries.intention_for) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(search_entries.requested_by, '')) LIKE ? ESCAPE '\\')
      )
    )`);
    parameters.push(intentionSearchPattern, intentionSearchPattern, intentionSearchPattern);
  }
  if (filters.dateFrom) {
    conditions.push('m.mass_date >= ?');
    parameters.push(filters.dateFrom);
  }
  if (filters.dateToExclusive) {
    conditions.push('m.mass_date < ?');
    parameters.push(filters.dateToExclusive);
  }
  if (filters.direction === 'future') {
    const today = filters.today ?? todayIsoDate();
    conditions.push('m.mass_date >= ?');
    parameters.push(today);
  } else if (filters.direction === 'past') {
    const today = filters.today ?? todayIsoDate();
    conditions.push('m.mass_date < ?');
    parameters.push(today);
  }
  if (filters.cursor) {
    const comparator = filters.direction === 'past' ? '<' : '>';
    conditions.push(`(m.mass_date ${comparator} ? OR (m.mass_date = ? AND m.uid ${comparator} ?))`);
    parameters.push(filters.cursor.date, filters.cursor.date, filters.cursor.uid);
  }

  const direction = filters.direction === 'past' ? 'DESC' : 'ASC';
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit == null ? '' : ' LIMIT ?';
  if (filters.limit != null) parameters.push(filters.limit);

  const massRows = rows(
    database,
    `SELECT m.*, c.name AS church_name FROM mass_intentions m JOIN churches c ON c.uid = m.church_uid ${where} ORDER BY m.mass_date ${direction}, m.uid ${direction}${limit}`,
    parameters,
  );
  const massUids = massRows.map((mass) => stringValue(mass.uid));
  const entryRows = massUids.length === 0
    ? []
    : batches(massUids, SQLITE_PARAMETER_BATCH_SIZE).flatMap((batch) =>
        rows(
          database,
          `SELECT * FROM intention_entries WHERE mass_intention_uid IN (${batch.map(() => '?').join(',')}) ORDER BY mass_intention_uid, uid`,
          batch,
        ),
      );
  const entriesByMass = groupBy(entryRows, (row) => stringValue(row.mass_intention_uid));

  return massRows.map((row) => ({
    uid: stringValue(row.uid),
    church_id: stringValue(row.church_uid),
    date: stringValue(row.mass_date),
    time: stringValue(row.mass_time),
    intentions: (entriesByMass.get(stringValue(row.uid)) ?? [])
      .filter((entry) => {
        if (!intentionSearchTerm) return true;
        if (valueMatchesSearch(nullableString(row.church_name), intentionSearchTerm)) return true;
        return (
          valueMatchesSearch(nullableString(entry.intention_for), intentionSearchTerm) ||
          valueMatchesSearch(nullableString(entry.requested_by), intentionSearchTerm)
        );
      })
      .map((entry) => ({
        for: stringValue(entry.intention_for),
        by: nullableString(entry.requested_by),
      })),
    source_bulletin_link: stringValue(row.source_bulletin_link),
    extracted_at: stringValue(row.extracted_at),
  }));
}

export function queryEventFamilies(database: Database): string[] {
  return rows(database, 'SELECT DISTINCT family_of_parishes FROM events ORDER BY family_of_parishes')
    .map((row) => stringValue(row.family_of_parishes))
    .filter(Boolean);
}

export function queryIntentionChurchIds(database: Database): string[] {
  return rows(database, 'SELECT DISTINCT church_uid FROM mass_intentions ORDER BY church_uid')
    .map((row) => stringValue(row.church_uid))
    .filter(Boolean);
}

export function queryAll(database: Database) {
  return {
    churches: queryChurches(database),
    events: queryEvents(database),
    intentions: queryIntentions(database),
  };
}
