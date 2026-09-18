import type { APIRoute } from 'astro';
import { loadAllDataForBuild } from '../lib/databaseServer';
import { getSiteUrl } from '../utils/seo';

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export const GET: APIRoute = async ({ site }) => {
  const siteUrl = getSiteUrl(site);
  const { churches } = await loadAllDataForBuild();
  const routes = [
    '/',
    '/parishes/',
    '/mass-finder/',
    '/events/',
    ...churches.filter((church) => !church.hidden).map((church) => `/church/${church.id}/`),
  ];

  const urls = routes
    .map((route) => `  <url><loc>${escapeXml(new URL(route, siteUrl).href)}</loc></url>`)
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
