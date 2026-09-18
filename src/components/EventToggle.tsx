import { EventCard, isDatePast } from "./EventsView";
import type { Event } from "../types/church";

interface EventToggleProps {
  events: Event[];
}

export default function EventToggle({ events }: EventToggleProps) {
  return (
    <div>
      <ul className="space-y-2">
        {events.filter((event) => !isDatePast(event.date)).map((event) => {
          return <EventCard key={event.id} event={event} />
        })}
      </ul>
    </div>
  );
}
