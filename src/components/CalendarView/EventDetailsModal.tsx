import React from "react";
import { type CalendarEvent } from "./CalendarView";
import moment from "moment";

interface Props {
  event: CalendarEvent | null;
  onClose: () => void;
}

export function EventDetailsModal({ event, onClose }: Props) {
  if (!event) return null;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>{event.title}</h2>

        <p><strong>Church:</strong> {event.churchName}</p>

        {!event.allDay && (
          <p>
            <strong>Time:</strong>{" "}
            {moment(event.start).format("ddd HH:mm")} –{" "}
            {moment(event.end).format("HH:mm")}
          </p>
        )}

        {event.allDay && <p><strong>All Day Event</strong></p>}

        <p><strong>Type:</strong> {formatType(event.type)}</p>

        <button style={buttonStyle} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function formatType(t: string): string {
  switch (t) {
    case "mass": return "Mass";
    case "daily_mass": return "Daily Mass";
    case "confession": return "Confession";
    case "adoration": return "Adoration";
    default: return t;
  }
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 10000,
};

const modalStyle: React.CSSProperties = {
  background: "white",
  padding: "20px",
  borderRadius: "8px",
  width: "320px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
};

const buttonStyle: React.CSSProperties = {
  marginTop: "20px",
  padding: "8px 14px",
  background: "#0066ff",
  color: "white",
  border: "none",
  borderRadius: "5px",
  cursor: "pointer",
};
