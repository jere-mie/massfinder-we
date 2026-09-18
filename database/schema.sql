PRAGMA foreign_keys = ON;
PRAGMA user_version = 1;

CREATE TABLE IF NOT EXISTS churches (
    uid TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    family_of_parishes TEXT,
    address TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    map_url TEXT NOT NULL,
    website TEXT NOT NULL,
    hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
    bulletin_website TEXT,
    phone TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mass_schedules (
    uid TEXT PRIMARY KEY NOT NULL,
    church_uid TEXT NOT NULL REFERENCES churches(uid) ON DELETE CASCADE,
    schedule_type TEXT NOT NULL CHECK (schedule_type IN ('regular', 'daily')),
    day TEXT NOT NULL,
    time TEXT NOT NULL,
    note TEXT,
    day_of_month INTEGER
);

CREATE TABLE IF NOT EXISTS time_ranges (
    uid TEXT PRIMARY KEY NOT NULL,
    church_uid TEXT NOT NULL REFERENCES churches(uid) ON DELETE CASCADE,
    range_type TEXT NOT NULL CHECK (range_type IN ('confession', 'adoration')),
    day TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    note TEXT,
    day_of_month INTEGER
);

CREATE TABLE IF NOT EXISTS offices (
    uid TEXT PRIMARY KEY NOT NULL,
    church_uid TEXT NOT NULL REFERENCES churches(uid) ON DELETE CASCADE,
    building TEXT,
    address TEXT NOT NULL,
    phone TEXT,
    email TEXT
);

CREATE TABLE IF NOT EXISTS office_hours (
    uid TEXT PRIMARY KEY NOT NULL,
    office_uid TEXT NOT NULL REFERENCES offices(uid) ON DELETE CASCADE,
    day TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    note TEXT,
    day_of_month INTEGER
);

CREATE TABLE IF NOT EXISTS events (
    uid TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    church_uid TEXT REFERENCES churches(uid) ON DELETE SET NULL,
    church_name TEXT,
    family_of_parishes TEXT NOT NULL,
    event_date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    location TEXT,
    source_bulletin_link TEXT NOT NULL,
    source_bulletin_date TEXT NOT NULL,
    extracted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS event_tags (
    uid TEXT PRIMARY KEY NOT NULL,
    event_uid TEXT NOT NULL REFERENCES events(uid) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    UNIQUE (event_uid, tag)
);

CREATE TABLE IF NOT EXISTS mass_intentions (
    uid TEXT PRIMARY KEY NOT NULL,
    church_uid TEXT NOT NULL REFERENCES churches(uid) ON DELETE CASCADE,
    mass_date TEXT NOT NULL,
    mass_time TEXT NOT NULL,
    source_bulletin_link TEXT NOT NULL,
    extracted_at TEXT NOT NULL,
    UNIQUE (church_uid, mass_date, mass_time)
);

CREATE TABLE IF NOT EXISTS intention_entries (
    uid TEXT PRIMARY KEY NOT NULL,
    mass_intention_uid TEXT NOT NULL REFERENCES mass_intentions(uid) ON DELETE CASCADE,
    intention_for TEXT NOT NULL,
    requested_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_mass_schedules_church ON mass_schedules(church_uid);
CREATE INDEX IF NOT EXISTS idx_mass_schedules_day ON mass_schedules(day);
CREATE INDEX IF NOT EXISTS idx_time_ranges_church ON time_ranges(church_uid);
CREATE INDEX IF NOT EXISTS idx_offices_church ON offices(church_uid);
CREATE INDEX IF NOT EXISTS idx_office_hours_office ON office_hours(office_uid);
CREATE INDEX IF NOT EXISTS idx_events_date_uid ON events(event_date, uid);
CREATE INDEX IF NOT EXISTS idx_events_family_date_uid ON events(family_of_parishes, event_date, uid);
CREATE INDEX IF NOT EXISTS idx_mass_intentions_date_uid ON mass_intentions(mass_date, uid);
CREATE INDEX IF NOT EXISTS idx_mass_intentions_church_date_uid ON mass_intentions(church_uid, mass_date, uid);
CREATE INDEX IF NOT EXISTS idx_intention_entries_mass ON intention_entries(mass_intention_uid);
