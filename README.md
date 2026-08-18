# Windsor-Essex Deanery

The official website for the Windsor-Essex Deanery, serving the Catholic parishes and communities of Windsor-Essex County, Ontario. The site brings together parish information, worship schedules, and local Catholic events in one place.

🌐 **Live Site**: [www.wedeanery.ca](https://www.wedeanery.ca)

## Features

- **Mass Finder**: Find Sunday and daily Mass times, confession schedules, and adoration times across the Deanery.
- **Parish Directory**: Explore the parishes and Families of Parishes that make up the Windsor-Essex Deanery.
- **Local Events**: Browse upcoming Catholic parish events, community gatherings, fundraisers, educational programs, and special liturgies.
- **Interactive Map**: View churches across Windsor-Essex on an interactive Leaflet map with detailed location popups.
- **Schedule Filters**: Filter worship schedules by day, time range, and schedule type.
- **Parish Details**: View parish addresses, contact information, websites, office hours, and available schedules.
- **Responsive Design**: Works seamlessly on desktop and mobile devices.

## Tech Stack

- **[Astro](https://astro.build/)**: Static site generator with partial hydration
- **[React](https://react.dev/)**: Component-based UI library
- **[TypeScript](https://www.typescriptlang.org/)**: Type-safe JavaScript
- **[Tailwind CSS](https://tailwindcss.com/)**: Utility-first CSS framework
- **[Leaflet](https://leafletjs.com/)** + **[react-leaflet](https://react-leaflet.js.org/)**: Interactive maps

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or pnpm

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/jere-mie/massfinder-we.git
   cd massfinder-we
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the dev server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   ```
   http://localhost:4321
   ```

### Build for Production

```bash
npm run build
npm run preview  # Preview the build locally
```


## Development Guidelines

### Adding a New Church

Edit `public/churches.json` and ensure the correct structure is followed.

**Important conventions:**
- All arrays are **required** (use empty `[]` if none)
- Times use **24-hour `HHMM` format** (e.g., `"1830"` for 6:30 PM)
- Office hours use `offices[].hours[]` entries with a full weekday and `start`/`end` in **24-hour `HHMM` format**; use separate entries for split shifts
- Office `phone` and `email` fields are optional and should only be included when published by the parish
- Coordinates: `[latitude, longitude]` order
- Phone: Include `+1` country code
- Optional `note` field available for all time entries

### Utility Functions

Common utilities in `src/utils/`:

- `formatTime(time)` - Convert `"1830"` → `"6:30 PM"`
- `formatPhoneNumber(phone)` - Format to `"(519) 736-5418"`
- `formatUrl(url)` - Strip protocol and trailing slash
- `DAYS_OF_WEEK` - Ordered array of day names
- `TIME_OPTIONS` - Time select options

### Styling

- Use Tailwind utility classes
- Custom styles in `src/styles/global.css`
- Responsive breakpoints: `sm:`, `md:`, `lg:`, `xl:`

## Data Maintenance

Church information should be updated regularly:

- **Mass times**: Verify at least annually or when notified of changes
- **Websites/phones**: Check for updates when adding new churches
- **Coordinates**: Ensure markers appear at correct building locations

## License

See [LICENSE](LICENSE) file for details.

## Questions or Issues?

- Open an issue on GitHub.
- Contact: [Jeremie Bornais](https://github.com/jere-mie) or [Justin Bornais](https://github.com/justinbornais).

## Acknowledgments

- Church data sourced from parish websites and public listings
- Map tiles provided by OpenStreetMap
- Built with Astro, React, Tailwind CSS, and Leaflet
