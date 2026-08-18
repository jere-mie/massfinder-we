// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.wedeanery.ca/',
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: [
        '@fullcalendar/core',
        '@fullcalendar/daygrid',
        '@fullcalendar/interaction',
        '@fullcalendar/list',
        '@fullcalendar/react',
        '@fullcalendar/timegrid',
      ],
    },
  }
});
