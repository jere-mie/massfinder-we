import { useState } from "react";
import { EventCard, isDatePast } from "./EventsView";
import type { Event } from "../types/church";

interface EventToggleProps {
  events: Event[];
}

export default function EventToggle({ events }: EventToggleProps) {
  const [showPast, setShowPast] = useState(false);
  const now = new Date();

  return (
    <div>
      <div className="flex justify-end mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showPast}
            onChange={() => setShowPast(!showPast)}
          />
          <span>Show past events</span>
        </label>
      </div>

      <ul className="space-y-2">
        {events.map((event) => {
          if (!showPast && isDatePast(event.date)) return null;
          return <EventCard key={event.id} event={event} />
        })}
      </ul>
    </div>
  );
}
