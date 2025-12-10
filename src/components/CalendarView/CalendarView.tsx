import React, { useMemo } from "react";
import {
  Calendar,
  momentLocalizer,
  type Event as RBCEvent,
} from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";

import type { Church, Mass, TimeRange } from "../../types/church"; // adjust path

const WEEKS_TO_GENERATE = 8;
const localizer = momentLocalizer(moment);

/** Convert "HHMM" (e.g., "1830") to a Date based on a given weekday name */
function parseTime(dayName: string, HHMM: string): Date {
  const [hour, minute] = [HHMM.slice(0, 2), HHMM.slice(2)];
  const now = moment();

  // Sunday = 0 ... Saturday = 6.
  const weekdayIndex = moment().day(dayName).day();

  const date = now.clone().day(weekdayIndex).hour(+hour).minute(+minute).second(0);

  // If the chosen day is already in the past of this week, move to next week.
  if (date.isBefore(moment())) {
    date.add(7, "days");
  }

  return date.toDate();
}

interface CalendarEvent extends RBCEvent {
  type: "mass" | "daily_mass" | "confession" | "adoration";
  churchName: string;
}

// Weekly recurrence generator.
function generateWeeklyEvents<T extends CalendarEvent>(event: T, weeks: number): T[] {
  const copies: T[] = [];

  for (let i = 0; i < weeks; i++) {
    copies.push({
      ...event,
      start: moment(event.start).add(7 * i, "days").toDate(),
      end: moment(event.end).add(7 * i, "days").toDate(),
    });
  }

  return copies;
}

function massToEvent(m: Mass, church: Church): CalendarEvent {
  const start = parseTime(m.day, m.time);
  const end = moment(start).add(1, "hour").toDate();

  return {
    start,
    end,
    title: `${church.name} – Mass`,
    type: "mass",
    churchName: church.name,
  };
}

function dailyMassToEvent(m: Mass, church: Church): CalendarEvent {
  const start = parseTime(m.day, m.time);
  const end = moment(start).add(30, "minutes").toDate();

  return {
    start,
    end,
    title: `${church.name} – Daily Mass`,
    type: "daily_mass",
    churchName: church.name,
  };
}

function timeRangeToEvent(t: TimeRange, church: Church, type: "confession" | "adoration"): CalendarEvent {
  const start = parseTime(t.day, t.start);
  const end = parseTime(t.day, t.end);

  return {
    start,
    end,
    title: `${church.name} – ${type === "confession" ? "Confession" : "Adoration"}`,
    type,
    churchName: church.name,
  };
}

interface Props {
  churches: Church[];
}

export function CalendarView({ churches }: Props) {
  const events = useMemo(() => {
    if (!churches) return [];

    const all: CalendarEvent[] = [];

    for (const church of churches) {
      for (const m of church.masses) {
        const e = massToEvent(m, church);
        all.push(...generateWeeklyEvents(e, WEEKS_TO_GENERATE));
      }

      for (const m of church.daily_masses) {
        const e = dailyMassToEvent(m, church);
        all.push(...generateWeeklyEvents(e, WEEKS_TO_GENERATE));
      }

      for (const c of church.confession) {
        const e = timeRangeToEvent(c, church, "confession");
        all.push(...generateWeeklyEvents(e, WEEKS_TO_GENERATE));
      }

      for (const a of church.adoration) {
        const e = timeRangeToEvent(a, church, "adoration");
        all.push(...generateWeeklyEvents(e, WEEKS_TO_GENERATE));
      }
    }

    return all;
  }, [churches]);

  // Color styles.
  const eventStyleGetter = (event: CalendarEvent) => {
    let backgroundColor = "#3174ad";

    switch (event.type) {
      case "mass":
        backgroundColor = "#2a71d0";
        break;
      case "daily_mass":
        backgroundColor = "#6fa8dc";
        break;
      case "confession":
        backgroundColor = "#e06666";
        break;
      case "adoration":
        backgroundColor = "#d4af37";
        break;
    }

    return {
      style: {
        backgroundColor,
        color: "white",
        borderRadius: "6px",
        border: "none",
        fontSize: "0.85rem",
        padding: "2px 4px",
      },
    };
  };

  return (
    <div style={{ height: "80vh", width: "100%" }}>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        eventPropGetter={eventStyleGetter}
        views={["month", "week", "day", "agenda"]}
      />
    </div>
  );
}
