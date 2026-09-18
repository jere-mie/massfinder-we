"""SQLite persistence and read helpers for the Mass Finder data store."""

import hashlib
import json
import logging
import sqlite3
from pathlib import Path

logger = logging.getLogger(__name__)


def stable_uid(prefix, *parts):
    """Return a deterministic text UID for a normalized child record."""
    payload = json.dumps(parts, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:20]
    return f"{prefix}_{digest}"


def open_database(database_path):
    """Open and initialize the SQLite database."""
    path = Path(database_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    schema_path = Path(__file__).resolve().parents[2] / "database" / "schema.sql"
    connection.executescript(schema_path.read_text(encoding="utf-8"))
    return connection


def _rows_to_dicts(rows):
    return [dict(row) for row in rows]


def load_churches(connection):
    """Load normalized churches and reassemble the scraper's LLM input shape."""
    churches = []
    church_rows = connection.execute("SELECT * FROM churches ORDER BY uid").fetchall()
    for church in church_rows:
        result = {
            "id": church["uid"],
            "name": church["name"],
            "familyOfParishes": church["family_of_parishes"],
            "address": church["address"],
            "coordinates": [church["latitude"], church["longitude"]],
            "map": church["map_url"],
            "website": church["website"],
            "phone": church["phone"],
            "masses": [],
            "daily_masses": [],
            "confession": [],
            "adoration": [],
            "offices": [],
        }
        if church["hidden"]:
            result["hidden"] = True
        if church["bulletin_website"]:
            result["bulletin_website"] = church["bulletin_website"]

        schedules = connection.execute(
            "SELECT * FROM mass_schedules WHERE church_uid = ? ORDER BY uid",
            (church["uid"],),
        ).fetchall()
        for schedule in schedules:
            mass = {"day": schedule["day"], "time": schedule["time"]}
            if schedule["note"] is not None:
                mass["note"] = schedule["note"]
            if schedule["day_of_month"] is not None:
                mass["dayOfMonth"] = schedule["day_of_month"]
            result["daily_masses" if schedule["schedule_type"] == "daily" else "masses"].append(mass)

        ranges = connection.execute(
            "SELECT * FROM time_ranges WHERE church_uid = ? ORDER BY uid",
            (church["uid"],),
        ).fetchall()
        for time_range in ranges:
            item = {
                "day": time_range["day"],
                "start": time_range["start_time"],
                "end": time_range["end_time"],
            }
            if time_range["note"] is not None:
                item["note"] = time_range["note"]
            if time_range["day_of_month"] is not None:
                item["dayOfMonth"] = time_range["day_of_month"]
            result["confession" if time_range["range_type"] == "confession" else "adoration"].append(item)

        offices = connection.execute(
            "SELECT * FROM offices WHERE church_uid = ? ORDER BY uid",
            (church["uid"],),
        ).fetchall()
        for office in offices:
            item = {"address": office["address"], "hours": []}
            for field in ("building", "phone", "email"):
                if office[field] is not None:
                    item[field] = office[field]
            hours = connection.execute(
                "SELECT * FROM office_hours WHERE office_uid = ? ORDER BY uid",
                (office["uid"],),
            ).fetchall()
            for hour in hours:
                hour_item = {
                    "day": hour["day"],
                    "start": hour["start_time"],
                    "end": hour["end_time"],
                }
                if hour["note"] is not None:
                    hour_item["note"] = hour["note"]
                if hour["day_of_month"] is not None:
                    hour_item["dayOfMonth"] = hour["day_of_month"]
                item["hours"].append(hour_item)
            result["offices"].append(item)
        churches.append(result)
    return churches


def load_events(connection):
    """Load events with their normalized tags."""
    events = []
    for event in connection.execute("SELECT * FROM events ORDER BY event_date, uid").fetchall():
        item = {
            "id": event["uid"],
            "title": event["title"],
            "description": event["description"],
            "church_id": event["church_uid"],
            "church_name": event["church_name"],
            "family_of_parishes": event["family_of_parishes"],
            "date": event["event_date"],
            "start_time": event["start_time"],
            "end_time": event["end_time"],
            "location": event["location"],
            "source_bulletin_link": event["source_bulletin_link"],
            "source_bulletin_date": event["source_bulletin_date"],
            "extracted_at": event["extracted_at"],
            "tags": [
                row["tag"]
                for row in connection.execute(
                    "SELECT tag FROM event_tags WHERE event_uid = ? ORDER BY tag", (event["uid"],)
                ).fetchall()
            ],
        }
        events.append(item)
    return events


def load_intentions(connection):
    """Load mass intentions with normalized intention entries."""
    intentions = []
    for mass in connection.execute("SELECT * FROM mass_intentions ORDER BY mass_date, mass_time, uid").fetchall():
        intentions.append({
            "church_id": mass["church_uid"],
            "date": mass["mass_date"],
            "time": mass["mass_time"],
            "intentions": [
                {"for": row["intention_for"], "by": row["requested_by"]}
                for row in connection.execute(
                    "SELECT intention_for, requested_by FROM intention_entries WHERE mass_intention_uid = ? ORDER BY uid",
                    (mass["uid"],),
                ).fetchall()
            ],
            "source_bulletin_link": mass["source_bulletin_link"],
            "extracted_at": mass["extracted_at"],
        })
    return intentions


def replace_churches(connection, churches):
    """Replace all church data and normalized schedule children atomically."""
    with connection:
        connection.execute("DELETE FROM churches")
        for church in churches:
            uid = church["id"]
            coordinates = church.get("coordinates") or [0, 0]
            connection.execute(
                """INSERT INTO churches
                    (uid, name, family_of_parishes, address, latitude, longitude,
                     map_url, website, hidden, bulletin_website, phone)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (uid, church["name"], church.get("familyOfParishes"), church["address"],
                 coordinates[0], coordinates[1], church.get("map", ""), church.get("website", ""),
                 1 if church.get("hidden") else 0, church.get("bulletin_website"), church.get("phone", "")),
            )
            for schedule_type, key in (("regular", "masses"), ("daily", "daily_masses")):
                for index, mass in enumerate(church.get(key, [])):
                    schedule_uid = stable_uid("mass", uid, schedule_type, index, mass)
                    connection.execute(
                        "INSERT INTO mass_schedules (uid, church_uid, schedule_type, day, time, note, day_of_month) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (schedule_uid, uid, schedule_type, mass["day"], mass["time"], mass.get("note"), mass.get("dayOfMonth")),
                    )
            for range_type, key in (("confession", "confession"), ("adoration", "adoration")):
                for index, time_range in enumerate(church.get(key, [])):
                    range_uid = stable_uid("range", uid, range_type, index, time_range)
                    connection.execute(
                        "INSERT INTO time_ranges (uid, church_uid, range_type, day, start_time, end_time, note, day_of_month) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        (range_uid, uid, range_type, time_range["day"], time_range["start"], time_range["end"], time_range.get("note"), time_range.get("dayOfMonth")),
                    )
            for index, office in enumerate(church.get("offices", [])):
                office_uid = stable_uid("office", uid, index, office)
                connection.execute(
                    "INSERT INTO offices (uid, church_uid, building, address, phone, email) VALUES (?, ?, ?, ?, ?, ?)",
                    (office_uid, uid, office.get("building"), office["address"], office.get("phone"), office.get("email")),
                )
                for hour_index, hour in enumerate(office.get("hours", [])):
                    hour_uid = stable_uid("office_hour", office_uid, hour_index, hour)
                    connection.execute(
                        "INSERT INTO office_hours (uid, office_uid, day, start_time, end_time, note, day_of_month) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (hour_uid, office_uid, hour["day"], hour["start"], hour["end"], hour.get("note"), hour.get("dayOfMonth")),
                    )


def replace_events(connection, events):
    """Replace all event data, preserving the text UID from the source."""
    with connection:
        connection.execute("DELETE FROM events")
        for event in events:
            uid = event.get("id") or stable_uid("event", event)
            connection.execute(
                """INSERT INTO events
                    (uid, title, description, church_uid, church_name, family_of_parishes,
                     event_date, start_time, end_time, location, source_bulletin_link,
                     source_bulletin_date, extracted_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (uid, event["title"], event.get("description", ""), event.get("church_id"), event.get("church_name"),
                 event.get("family_of_parishes", ""), event["date"], event.get("start_time"), event.get("end_time"),
                 event.get("location"), event.get("source_bulletin_link", ""), event.get("source_bulletin_date", ""),
                 event.get("extracted_at", "")),
            )
            for tag in sorted(set(event.get("tags", []))):
                tag_uid = stable_uid("event_tag", uid, tag)
                connection.execute("INSERT INTO event_tags (uid, event_uid, tag) VALUES (?, ?, ?)", (tag_uid, uid, tag))


def replace_intentions(connection, intentions):
    """Replace all mass intentions and their normalized entries."""
    with connection:
        connection.execute("DELETE FROM mass_intentions")
        for mass in intentions:
            mass_uid = stable_uid("mass_intention", mass.get("church_id"), mass.get("date"), mass.get("time"), mass.get("source_bulletin_link"))
            connection.execute(
                """INSERT INTO mass_intentions
                    (uid, church_uid, mass_date, mass_time, source_bulletin_link, extracted_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (mass_uid, mass["church_id"], mass["date"], mass["time"], mass.get("source_bulletin_link", ""), mass.get("extracted_at", "")),
            )
            for index, intention in enumerate(mass.get("intentions", [])):
                entry_uid = stable_uid("intention", mass_uid, index, intention)
                connection.execute(
                    "INSERT INTO intention_entries (uid, mass_intention_uid, intention_for, requested_by) VALUES (?, ?, ?, ?)",
                    (entry_uid, mass_uid, intention["for"], intention.get("by")),
                )
