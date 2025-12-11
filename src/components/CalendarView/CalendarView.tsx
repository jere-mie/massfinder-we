import React, { useMemo, useState } from "react";
import {
  Calendar,
  momentLocalizer,
  type Event as RBCEvent,
} from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";

import type { Church, Mass, TimeRange } from "../../types/church"; // adjust path
import { FilterBar } from "./FilterBar";
import { EventDetailsModal } from "./EventDetailsModal";

const WEEKS_TO_GENERATE = 8;
const localizer = momentLocalizer(moment);

export type EventType = "mass" | "daily_mass" | "confession" | "adoration";
export type EventFilterState = Record<EventType, boolean>;
export const EVENT_COLORS: Record<EventType, string> = {
  mass: "#2a71d0",
  daily_mass: "#6fa8dc",
  confession: "#e06666",
  adoration: "#d4af37",
};

export interface CalendarEvent extends RBCEvent {
  type: EventType;
  churchName: string;
}

/** Convert "HHMM" (e.g., "1830") to a Date based on a given weekday name */
function parseTime(dayName: string, HHMM: string): Date[] {
  const [hour, minute] = [HHMM.slice(0, 2), HHMM.slice(2)];
  const now = moment();

  if (dayName.toLowerCase() === "every day") {
    const dates: Date[] = [];
    for (let weekday = 0; weekday < 7; weekday++) {
      const m = now.clone().day(weekday).hour(+hour).minute(+minute).second(0);
      
      // If the chosen day is already in the past of this week, move to next week.
      if (m.isBefore(now))
        m.add(7, "days");
      dates.push(m.toDate());
    }

    return dates;
  }

  // Sunday = 0 ... Saturday = 6.
  const weekdayIndex = moment().day(dayName).day();
  const date = now.clone().day(weekdayIndex).hour(+hour).minute(+minute).second(0);

  // If the chosen day is already in the past of this week, move to next week.
  if (date.isBefore(moment()))
    date.add(7, "days");

  return [date.toDate()];
}

function parseTimeRange(t: TimeRange): { start: Date; end: Date }[] {
  const startDates = parseTime(t.day, t.start);
  const endDates = parseTime(t.day, t.end);

  // Safety check — these should always match in length.
  if (startDates.length !== endDates.length) {
    console.warn(`Mismatched start/end lengths for "${t.day}" time range.`);
  }

  const count = Math.min(startDates.length, endDates.length);
  const ranges: { start: Date; end: Date }[] = [];

  for (let i = 0; i < count; i++) {
    ranges.push({
      start: startDates[i],
      end: endDates[i]
    });
  }

  return ranges;
}

// Weekly recurrence generator.
function generateWeeklyEvents<T extends CalendarEvent>(events: T[], weeks: number): T[] {
  const copies: T[] = [];

  for (const event of events) {
    for (let i = 0; i < weeks; i++) {
      copies.push({
        ...event,
        start: moment(event.start).add(7 * i, "days").toDate(),
        end: moment(event.end).add(7 * i, "days").toDate(),
      });
    }
  }

  return copies;
}

function massToEvent(m: Mass, church: Church, daily: boolean): CalendarEvent[] {
  const starts = parseTime(m.day, m.time);
  const events: CalendarEvent[] = [];
  starts.forEach(start => {
    const end = moment(start).add(daily ? 30 : 60, "minutes").toDate();
    events.push({
      start: start,
      end: moment(start).add(daily ? 30 : 60, "minutes").toDate(),
      title: `${church.name} - ${daily ? 'Daily ' : ''}Mass`,
      type: daily ? "daily_mass" : "mass",
      churchName: church.name
    });
  });

  return events;
}

function timeRangeToEvent(t: TimeRange, church: Church, eventType: "confession" | "adoration"): CalendarEvent[] {
  const ranges = parseTimeRange(t);

  return ranges.map(r => ({
    start: r.start,
    end: r.end,
    title: `${church.name} – ${eventType === "confession" ? "Confession" : "Adoration"}`,
    type: eventType,
    churchName: church.name,
    allDay: t.start === "0000" && t.end === "2359"
  }));;
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
        const events = massToEvent(m, church, false);
        all.push(...generateWeeklyEvents(events, WEEKS_TO_GENERATE));
      }

      for (const m of church.daily_masses) {
        const events = massToEvent(m, church, true);
        all.push(...generateWeeklyEvents(events, WEEKS_TO_GENERATE));
      }

      for (const c of church.confession) {
        const events = timeRangeToEvent(c, church, "confession");
        all.push(...generateWeeklyEvents(events, WEEKS_TO_GENERATE));
      }

      for (const a of church.adoration) {
        const events = timeRangeToEvent(a, church, "adoration");
        all.push(...generateWeeklyEvents(events, WEEKS_TO_GENERATE));
      }
    }

    return all;
  }, [churches]);

  const [filters, setFilters] = useState<EventFilterState>({
    mass: true,
    daily_mass: false,
    confession: false,
    adoration: false
  });
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const visibleEvents = events.filter(event => filters[event.type]);

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
    <div>
      <FilterBar filters={filters} setFilters={setFilters} />
      <div style={{ height: "80vh", width: "100%", overflowX: "auto" }}>
        <Calendar
          localizer={localizer}
          events={visibleEvents}
          startAccessor="start"
          endAccessor="end"
          step={15}
          timeslots={4}
          eventPropGetter={eventStyleGetter}
          views={["month", "day", "agenda"]}
          dayLayoutAlgorithm={"no-overlap"}
          onSelectEvent={(event) => setSelectedEvent(event)}
        />
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      </div>
    </div>
  );
}
