# WE Catholic Mass List

Find Catholic Mass times, confession schedules, and adoration times for churches in Windsor-Essex County, Ontario.

🌐 **Live Site**: [mass.bornais.ca](https://mass.bornais.ca)

## Features

- **Interactive Map**: View all churches on an interactive Leaflet map with detailed popups
- **Filterable Tables**: Browse mass times, daily masses, confession, and adoration schedules
- **Smart Filtering**: Filter by day, time range, and event type
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Accessibility**: ARIA labels and keyboard navigation support

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

### Project Structure

```
massfinder-we/
├── public/
│   └── churches.json              # Church data (single source of truth)
├── src/
│   ├── components/
│   │   ├── App.tsx                # Root React component
│   │   ├── Header.tsx             # Tab navigation
│   │   ├── ListView/              # List view components
│   │   │   ├── ListView.tsx
│   │   │   ├── DataTable.tsx
│   │   │   └── FilterCard.tsx
│   │   └── MapView/               # Map view components
│   │       ├── MapView.tsx
│   │       ├── ChurchPopup.tsx
│   │       └── FilterPanel.tsx
│   ├── hooks/
│   │   └── useChurches.ts         # Data fetching hook
│   ├── types/
│   │   └── church.ts              # TypeScript interfaces
│   ├── utils/
│   │   ├── constants.ts           # App constants
│   │   ├── filtering.ts           # Filter logic
│   │   └── formatting.ts          # Display formatting
│   ├── layouts/
│   │   └── Layout.astro           # Base HTML layout
│   ├── pages/
│   │   └── index.astro            # Home page
│   └── styles/
│       └── global.css             # Global styles + Tailwind
├── astro.config.mjs               # Astro configuration
├── tailwind.config.js             # Tailwind configuration
└── tsconfig.json                  # TypeScript configuration
```

## Development Guidelines

### Adding a New Church

Edit `public/churches.json` with the following structure:

```json
{
  "name": "Church Name",
  "address": "123 Main St, City, ON N0R 1K0",
  "coordinates": [42.1234, -83.5678],
  "map": "https://maps.app.goo.gl/...",
  "website": "https://example.com",
  "phone": "+15197365418",
  "masses": [
    {"day": "Sunday", "time": "0900"}
  ],
  "daily_masses": [
    {"day": "Wednesday", "time": "1700"}
  ],
  "confession": [
    {"day": "Saturday", "start": "1600", "end": "1645", "note": "Optional note"}
  ],
  "adoration": [
    {"day": "Friday", "start": "0900", "end": "1700"}
  ]
}
```

**Important conventions:**
- All arrays are **required** (use empty `[]` if none)
- Times use **24-hour `HHMM` format** (e.g., `"1830"` for 6:30 PM)
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

- Open an issue on GitHub
- Contact: [Jeremie Bornais](https://github.com/jere-mie)

## Acknowledgments

- Church data sourced from parish websites and public listings
- Map tiles provided by OpenStreetMap
- Built with Astro, React, Tailwind CSS, and Leaflet
