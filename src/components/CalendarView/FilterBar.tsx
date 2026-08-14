import React from "react";
import { EVENT_TYPE_META, type EventFilterState, type EventType } from './calendarTypes';

interface FilterBarProps {
  filters: EventFilterState;
  setFilters: React.Dispatch<React.SetStateAction<EventFilterState>>;
}

export function FilterBar({ filters, setFilters }: FilterBarProps) {
  function toggle(type: EventType) {
    setFilters((prev: EventFilterState) => ({
      ...prev,
      [type]: !prev[type]
    }));
  }

  const types: EventType[] = ['mass', 'daily_mass', 'confession', 'adoration'];

  return (
    <div className="calendar-filter-bar" aria-label="Schedule types">
      {types.map(type => {
        const active = filters[type];
        const { color, label } = EVENT_TYPE_META[type];
        return (
          <button
            key={type}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(type)}
            style={{
              borderColor: color,
              backgroundColor: active ? color : 'white',
              color: active ? 'white' : color,
            }}
          >
            <span className="calendar-filter-swatch" style={{ backgroundColor: active ? 'white' : color }} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
