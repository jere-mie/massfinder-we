import type { EventTag } from '../types/church';

export interface EventTagMeta {
  label: string;
  chipClassName: string;
  calendarColor: string;
}

/**
 * Shared event-section presentation. Keeping the list chips and calendar colors
 * together prevents the two views from drifting as sections change.
 */
export const EVENT_TAG_META: Record<EventTag, EventTagMeta> = {
  devotion: {
    label: 'Devotion',
    chipClassName: 'bg-violet-100 text-violet-800',
    calendarColor: '#6d28d9',
  },
  faith_formation: {
    label: 'Faith Formation',
    chipClassName: 'bg-amber-100 text-amber-800',
    calendarColor: '#a16207',
  },
  fundraiser: {
    label: 'Fundraiser',
    chipClassName: 'bg-green-100 text-green-800',
    calendarColor: '#15803d',
  },
  liturgy: {
    label: 'Liturgy',
    chipClassName: 'bg-purple-100 text-purple-800',
    calendarColor: '#7e22ce',
  },
  meeting: {
    label: 'Meeting',
    chipClassName: 'bg-gray-100 text-gray-800',
    calendarColor: '#374151',
  },
  music_arts: {
    label: 'Music & Arts',
    chipClassName: 'bg-fuchsia-100 text-fuchsia-800',
    calendarColor: '#a21caf',
  },
  outreach: {
    label: 'Outreach',
    chipClassName: 'bg-orange-100 text-orange-800',
    calendarColor: '#c2410c',
  },
  retreat: {
    label: 'Retreat',
    chipClassName: 'bg-indigo-100 text-indigo-800',
    calendarColor: '#4338ca',
  },
  sacramental: {
    label: 'Sacramental',
    chipClassName: 'bg-pink-100 text-pink-800',
    calendarColor: '#be185d',
  },
  seasonal: {
    label: 'Seasonal',
    chipClassName: 'bg-red-100 text-red-800',
    calendarColor: '#b91c1c',
  },
  social: {
    label: 'Social',
    chipClassName: 'bg-blue-100 text-blue-800',
    calendarColor: '#1d4ed8',
  },
  volunteer: {
    label: 'Volunteer',
    chipClassName: 'bg-teal-100 text-teal-800',
    calendarColor: '#0f766e',
  },
  other: {
    label: 'Other',
    chipClassName: 'bg-slate-100 text-slate-800',
    calendarColor: '#334155',
  },
};

export function getEventTagMeta(tag: string | null | undefined): EventTagMeta {
  const normalized = tag?.toLowerCase() as EventTag | undefined;
  return (normalized && EVENT_TAG_META[normalized]) || EVENT_TAG_META.other;
}
