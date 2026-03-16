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

  if (!start_time) {
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

  // parse HHMM into HH:MM
  const sh = start_time.slice(0, 2);
  const sm = start_time.slice(2, 4);
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

  lines.push(`SUMMARY:${(event.title || '').replace(/\n/g, '\\n')}`);
  if (event.description) lines.push(`DESCRIPTION:${(event.description || '').replace(/\n/g, '\\n')}`);
  if (event.location) lines.push(`LOCATION:${(event.location || '').replace(/\n/g, '\\n')}`);
  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  const ics = lines.join('\r\n');
  return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
}
