import type { Church, Event } from '../types/church';

export type StructuredData = Record<string, unknown>;

export const SITE_URL = new URL('https://www.wedeanery.ca/');
export const SOCIAL_IMAGE_PATH = '/wedeanery.png';

export function getSiteUrl(site?: URL): URL {
  return site ?? SITE_URL;
}

export function getCanonicalUrl(pathname: string, site?: URL): URL {
  const canonicalUrl = new URL(pathname, getSiteUrl(site));
  canonicalUrl.search = '';
  canonicalUrl.hash = '';
  return canonicalUrl;
}

export function getSocialImageUrl(site?: URL): URL {
  return new URL(SOCIAL_IMAGE_PATH, getSiteUrl(site));
}

export function getBaseStructuredData(description: string, site?: URL): StructuredData[] {
  const siteUrl = getSiteUrl(site);
  const socialImageUrl = getSocialImageUrl(site);

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Deanery of Windsor-Essex',
      url: siteUrl.href,
      logo: socialImageUrl.href,
      areaServed: {
        '@type': 'AdministrativeArea',
        name: 'Windsor-Essex County, Ontario',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Deanery of Windsor-Essex',
      url: siteUrl.href,
      description,
    },
  ];
}

interface CollectionPageOptions {
  name: string;
  pathname: string;
  description: string;
  mainEntity?: StructuredData;
}

export function createCollectionPageStructuredData({
  name,
  pathname,
  description,
  mainEntity,
}: CollectionPageOptions): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    url: getCanonicalUrl(pathname).href,
    description,
    ...(mainEntity ? { mainEntity } : {}),
  };
}

export function createChurchStructuredData(church: Church): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@type': 'Church',
    name: church.name,
    url: getCanonicalUrl(`/church/${church.id}/`).href,
    address: {
      '@type': 'PostalAddress',
      streetAddress: church.address,
      addressCountry: 'CA',
    },
    telephone: church.phone,
    sameAs: church.website,
    hasMap: church.map,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: church.coordinates[0],
      longitude: church.coordinates[1],
    },
  };
}

export function createEventStructuredData(event: Event): StructuredData {
  const startDate = event.start_time
    ? `${event.date}T${event.start_time.slice(0, 2)}:${event.start_time.slice(2, 4)}`
    : event.date;
  const endDate = event.end_time
    ? `${event.date}T${event.end_time.slice(0, 2)}:${event.end_time.slice(2, 4)}`
    : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.description,
    url: getCanonicalUrl(`/events/${event.id}/`).href,
    startDate,
    ...(endDate ? { endDate } : {}),
    ...(event.location
      ? {
          location: {
            '@type': 'Place',
            name: event.location,
          },
        }
      : {}),
    organizer: {
      '@type': 'Organization',
      name: event.family_of_parishes,
    },
  };
}
