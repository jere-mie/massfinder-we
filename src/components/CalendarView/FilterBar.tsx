import React from "react";
import { EVENT_COLORS, type EventFilterState, type EventType } from "./CalendarView";

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

  const types: EventType[] = ["mass", "daily_mass", "confession", "adoration"];

  return (
    <div style={{
      display: "flex",
      gap: "10px",
      marginBottom: "12px",
      flexWrap: "wrap"
    }}>
      {types.map(type => {
        const active = filters[type];
        const baseColor = EVENT_COLORS[type];
        return (
          <button
            key={type}
            onClick={() => toggle(type)}
            style={{
              padding: "6px 14px",
              borderRadius: "20px",
              border: "1px solid",
              borderColor: active ? baseColor : "#aaa",
              backgroundColor: active ? baseColor : "white",
              color: active ? "white" : baseColor,
              cursor: "pointer",
              fontSize: "14px",
              transition: "all 0.2s ease",
            }}
          >
            {labelFor(type)}
          </button>
        );
      })}
    </div>
  );
}

/** Map type → nice label */
function labelFor(type: EventType): string {
  switch (type) {
    case "mass": return "Mass";
    case "daily_mass": return "Daily Mass";
    case "confession": return "Confession";
    case "adoration": return "Adoration";
    default: return ""
  };
}
