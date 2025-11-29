/**
 * Convert a church name to a URL-safe slug
 * @param name - Church name
 * @returns URL-safe slug
 * @example slugify("St. John the Baptist") // Returns: "st-john-the-baptist"
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Generate the URL path for a church page
 * @param churchName - Name of the church
 * @returns URL path for the church page
 */
export function getChurchPath(churchName: string): string {
  return `/church/${slugify(churchName)}`;
}
