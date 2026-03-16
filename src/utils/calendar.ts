function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function toUtcCalString(d: Date) {
  // YYYYMMDDTHHMMSSZ
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function escapeIcsText(text: string): string {
  // Normalize CRLF/CR to LF, then escape per RFC 5545: backslash, comma, semicolon, newline
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return normalized
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');
}

function toDateOnlyString(d: Date) {
  // YYYYMMDD
  return d.getFullYear().toString() + pad(d.getMonth() + 1) + pad(d.getDate());
}

export type CalendarEventInput = {
  date: string;
  start_time?: string | null;
  end_time?: string | null;
};

export function getEventDateRange(event: CalendarEventInput) {
  const { date, start_time, end_time } = event;
  const hasStart = !!start_time;
  const hasEnd = !!end_time;

  if (!hasStart && !hasEnd) {
    // all-day event -> use date only, end is next day (exclusive)
    const start = new Date(date + 'T00:00:00');
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return {
      allDay: true,
      startDate: toDateOnlyString(start),
      endDate: toDateOnlyString(end),
    };
  }

  if (!hasStart && hasEnd) {
    // deadline-style event with only an end time
    // interpret as a short timed event ending at end_time,
    // with the same default 2-hour duration used elsewhere
    const eh = end_time!.slice(0, 2);
    const em = end_time!.slice(2, 4);
    const end = new Date(`${date}T${eh}:${em}:00`);
    const start = new Date(end);
    start.setHours(start.getHours() - 2);

    return {
      allDay: false,
      start: toUtcCalString(start),
      end: toUtcCalString(end),
      startLocal: start,
      endLocal: end,
    };
  }

  // parse HHMM into HH:MM
  const sh = start_time!.slice(0, 2);
  const sm = start_time!.slice(2, 4);
  const start = new Date(`${date}T${sh}:${sm}:00`);

  let end: Date;
  if (end_time) {
    const eh = end_time.slice(0, 2);
    const em = end_time.slice(2, 4);
    end = new Date(`${date}T${eh}:${em}:00`);
    // if end <= start, assume it goes to next day
    if (end <= start) end.setDate(end.getDate() + 1);
  } else {
    // default duration 2 hours
    end = new Date(start);
    end.setHours(end.getHours() + 2);
  }

  return {
    allDay: false,
    start: toUtcCalString(start),
    end: toUtcCalString(end),
    startLocal: start,
    endLocal: end,
  };
}

export function createGoogleCalendarUrl(
  event: CalendarEventInput & {
    title: string;
    description?: string | null;
    location?: string | null;
  },
) {
  const range = getEventDateRange(event);
  let datesParam = '';
  if (range.allDay) {
    datesParam = `${range.startDate}/${range.endDate}`;
  } else {
    datesParam = `${range.start}/${range.end}`;
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    details: event.description || '',
    location: event.location || '',
    dates: datesParam,
  });

  return `https://www.google.com/calendar/render?${params.toString()}`;
}

export function createIcsDataUri(
  event: CalendarEventInput & {
    id?: string;
    title: string;
    description?: string | null;
    location?: string | null;
  },
) {
  const range = getEventDateRange(event as any);
  const uid = event.id || `${Date.now()}@massfinder-we`;
  const now = new Date();
  const dtstamp = toUtcCalString(now);

  let dtstart = '';
  let dtend = '';
  if (range.allDay) {
    dtstart = range.startDate;
    dtend = range.endDate;
  } else {
    dtstart = range.start;
    dtend = range.end;
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//massfinder-we//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
  ];

  if (range.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
    lines.push(`DTEND;VALUE=DATE:${dtend}`);
  } else {
    lines.push(`DTSTART:${dtstart}`);
    lines.push(`DTEND:${dtend}`);
  }

  lines.push(`SUMMARY:${escapeIcsText(event.title || '')}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description || '')}`);
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location || '')}`);
  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  const ics = lines.join('\r\n');
  return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
}
