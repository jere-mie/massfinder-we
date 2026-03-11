import React, { useMemo, useState } from "react";
import {
  Calendar,
  momentLocalizer,
  type Event as RBCEvent,
} from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";

import type { Event } from "../types/church";
import { formatTime } from "../utils/formatting";

const localizer = momentLocalizer(moment);

// Hex equivalents of the bg-*-600 Tailwind shades (middle ground between light and dark).
export const EVENTS_TAG_COLORS: Record<string, string> = {
  community:  "#ea580c", // orange-600
  education:  "#ca8a04", // yellow-600
  fundraiser: "#16a34a", // green-600
  liturgy:    "#9333ea", // purple-600
  meeting:    "#4b5563", // gray-600
  retreat:    "#4f46e5", // indigo-600
  sacramental:"#db2777", // pink-600
  seasonal:   "#dc2626", // red-600
  social:     "#2563eb", // blue-600
  volunteer:  "#0d9488", // teal-600
  other:      "#475569", // slate-600
};

function getTagColor(tag: string | undefined): string {
  if (!tag) return EVENTS_TAG_COLORS.other;
  return EVENTS_TAG_COLORS[tag.toLowerCase()] ?? EVENTS_TAG_COLORS.other;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatEventTime(event: Event): string {
  if (!event.start_time && !event.end_time) return "";
  if (event.start_time && event.end_time) {
    return `${formatTime(event.start_time)} – ${formatTime(event.end_time)}`;
  }
  if (event.start_time) return formatTime(event.start_time);
  if (event.end_time) return `Until ${formatTime(event.end_time)}`;
  return "";
}

// ──────────────────────────────────────────────────────────────────────────────
// Calendar event wrapper
// ──────────────────────────────────────────────────────────────────────────────

export interface EventCalendarItem extends RBCEvent {
  originalEvent: Event;
}

function toCalendarItem(event: Event): EventCalendarItem {
  const [year, month, day] = event.date.split("-").map(Number);

  let start: Date;
  let end: Date;
  let allDay = false;

  if (event.start_time) {
    const sh = +event.start_time.slice(0, 2);
    const sm = +event.start_time.slice(2);
    start = new Date(year, month - 1, day, sh, sm);

    if (event.end_time) {
      const eh = +event.end_time.slice(0, 2);
      const em = +event.end_time.slice(2);
      end = new Date(year, month - 1, day, eh, em);
    } else {
      // Default to 1 hour if no end time provided.
      end = new Date(start.getTime() + 60 * 60 * 1000);
    }
  } else {
    // All-day event.
    start = new Date(year, month - 1, day);
    end = new Date(year, month - 1, day);
    allDay = true;
  }

  return { title: event.title, start, end, allDay, originalEvent: event };
}

// ──────────────────────────────────────────────────────────────────────────────
// Event details modal
// ──────────────────────────────────────────────────────────────────────────────

function EventModal({
  item,
  onClose,
}: {
  item: EventCalendarItem;
  onClose: () => void;
}) {
  const { originalEvent: event } = item;
  const timeDisplay = formatEventTime(event);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          padding: "24px",
          borderRadius: "10px",
          width: "380px",
          maxWidth: "92vw",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            marginBottom: "12px",
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "#111827",
          }}
        >
          {event.title}
        </h2>

        {/* Tags */}
        {event.tags.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: "6px",
              flexWrap: "wrap",
              marginBottom: "12px",
            }}
          >
            {event.tags.map((tag) => {
              const color = getTagColor(tag);
              return (
                <span
                  key={tag}
                  style={{
                    padding: "2px 10px",
                    borderRadius: "9999px",
                    fontSize: "0.75rem",
                    backgroundColor: color + "22",
                    color: color,
                    border: `1px solid ${color}55`,
                    fontWeight: 500,
                  }}
                >
                  {tag}
                </span>
              );
            })}
          </div>
        )}

        {event.description && (
          <p
            style={{
              color: "#4b5563",
              fontSize: "0.875rem",
              marginBottom: "14px",
              lineHeight: "1.5",
            }}
          >
            {event.description}
          </p>
        )}

        <div
          style={{ fontSize: "0.875rem", color: "#374151", marginBottom: "6px" }}
        >
          <strong>Date:</strong> {formatDate(event.date)}
          {timeDisplay && <> &bull; {timeDisplay}</>}
        </div>

        {event.location && (
          <div
            style={{
              fontSize: "0.875rem",
              color: "#374151",
              marginBottom: "6px",
            }}
          >
            <strong>Location:</strong> {event.location}
          </div>
        )}

        <div
          style={{ fontSize: "0.875rem", color: "#374151", marginBottom: "16px" }}
        >
          <strong>Parish:</strong> {event.church_name ?? event.family_of_parishes}
        </div>

        <div
          style={{
            borderTop: "1px solid #e5e7eb",
            paddingTop: "12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <a
            href={event.source_bulletin_link}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "0.8rem", color: "#2563eb" }}
          >
            View source bulletin →
          </a>
          <button
            onClick={onClose}
            style={{
              padding: "7px 16px",
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Color legend
// ──────────────────────────────────────────────────────────────────────────────

function ColorLegend({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
        marginBottom: "12px",
        alignItems: "center",
      }}
    >
      <span style={{ fontSize: "0.8rem", color: "#6b7280", fontWeight: 500 }}>
        Colors:
      </span>
      {tags.map((tag) => (
        <span
          key={tag}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "0.78rem",
            color: "#374151",
          }}
        >
          <span
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "3px",
              backgroundColor: getTagColor(tag),
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          {tag.charAt(0).toUpperCase() + tag.slice(1)}
        </span>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────────────────────

interface Props {
  events: Event[];
}

export function EventsCalendarView({ events }: Props) {
  const [selectedItem, setSelectedItem] = useState<EventCalendarItem | null>(null);

  const calendarEvents = useMemo<EventCalendarItem[]>(
    () => events.map(toCalendarItem),
    [events],
  );

  // Collect distinct tags present in the current event set for the legend.
  const presentTags = useMemo(() => {
    const seen = new Set<string>();
    events.forEach((e) => {
      if (e.tags[0]) seen.add(e.tags[0]);
    });
    // Sort so legend order is consistent.
    const order = Object.keys(EVENTS_TAG_COLORS);
    return order.filter((t) => seen.has(t));
  }, [events]);

  const eventStyleGetter = (event: EventCalendarItem) => {
    const firstTag = event.originalEvent.tags[0];
    return {
      style: {
        backgroundColor: getTagColor(firstTag),
        color: "white",
        borderRadius: "6px",
        border: "none",
        fontSize: "0.82rem",
        padding: "2px 5px",
      },
    };
  };

  return (
    <div>
      <ColorLegend tags={presentTags} />
      <div style={{ height: "80vh", width: "100%", overflowX: "auto" }}>
        <Calendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start"
          endAccessor="end"
          step={15}
          timeslots={4}
          eventPropGetter={eventStyleGetter}
          views={["month", "day", "agenda"]}
          dayLayoutAlgorithm="no-overlap"
          defaultView="month"
          onSelectEvent={(event) => setSelectedItem(event as EventCalendarItem)}
        />
      </div>
      {selectedItem && (
        <EventModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}
