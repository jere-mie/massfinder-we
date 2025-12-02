/**
 * Generate the URL path for a church page
 * @param churchId - The unique id of the church
 * @returns URL path for the church page
 */
export function getChurchPath(churchId: string): string {
  return `/church/${churchId}`;
}
