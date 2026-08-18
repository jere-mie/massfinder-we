import fs from 'node:fs';
import path from 'node:path';
import type { APIRoute } from 'astro';
import type { Church } from '../types/church';
import { getSiteUrl } from '../utils/seo';

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export const GET: APIRoute = ({ site }) => {
  const siteUrl = getSiteUrl(site);
  const churchesPath = path.join(process.cwd(), 'public', 'churches.json');
  const churches = JSON.parse(fs.readFileSync(churchesPath, 'utf-8')) as Church[];
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
