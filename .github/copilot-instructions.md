# Copilot Instructions for WE Catholic Mass List

## Project Overview

This is a **static website** for finding Catholic Mass times in Windsor-Essex County, Ontario. The app displays church locations on an interactive map and in filterable table views. It's deployed via GitHub Pages (domain: `mass.bornais.ca`).

## Architecture & Tech Stack

- **Astro**: Static site generator with partial hydration
- **React**: UI components (hydrated client-side with `client:only="react"`)
- **TypeScript**: Full type safety throughout the codebase
- **Tailwind CSS v4**: Utility-first styling
- **Leaflet + react-leaflet**: Interactive maps with OpenStreetMap tiles

**Component hierarchy:**
```
App (src/components/App.tsx)
├── Header (tabs navigation)
├── MapView (Leaflet map + FilterPanel)
│   ├── ChurchPopup (marker popup content)
│   └── FilterPanel (slide-out filter sidebar)
└── ListView (sortable data tables)
    ├── FilterCard (day/section filters)
    └── DataTable (reusable table component)
```

## Key Data Structures

**Church object** (`public/churches.json`):
```json
{
  "name": "St. John the Baptist",
  "address": "225 Brock St, Amherstburg, ON",
  "coordinates": [42.103, -83.103],
  "map": "https://maps.app.goo.gl/...",
  "website": "http://...",
  "phone": "+15197365418",
  "masses": [{"day": "Saturday", "time": "1700"}],
  "daily_masses": [{"day": "Wednesday", "time": "0900"}],
  "confession": [{"day": "Saturday", "start": "0945", "end": "1030", "note": "..."}],
  "adoration": [{"day": "Wednesday", "start": "0930", "end": "2130"}]
}
```

**TypeScript types** (`src/types/church.ts`):
- `Church` - Full church object with all schedule arrays
- `Mass` - Single mass with day, time, optional note
- `TimeRange` - Confession/adoration with day, start, end, optional note
- `MapFilters` / `ListFilters` - Filter state interfaces
- `TabType` - `'map' | 'list'`

**Time format**: Always `HHMM` 24-hour strings (e.g., `"1830"` for 6:30 PM). Use `formatTime()` from `utils/formatting.ts` to display.

## Critical Patterns

### Component Communication
- **Map ↔ List interaction**: `App.tsx` uses `useRef<MapViewHandle>` to expose the MapView's `openMarkerPopup` method
- When church name clicked in ListView → switches to map tab → opens that church's popup via the ref
- Pattern: `forwardRef` + `useImperativeHandle` in MapView exposes the handler

### Filtering Logic
- MapView: Filters churches by `filterType` (masses/confession/adoration), day, and time range
- ListView: Filters by day and section (separate from map filters)
- Filter functions in `src/utils/filtering.ts`
- Filters use `HHMM` string comparison (`>=` and `<=`) for time ranges

### Sorting Convention
Day order: `["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]`
Then by time (ascending). See `DAYS_ORDER` in `constants.ts`.

### Leaflet SSR Handling
Leaflet requires browser APIs, so the App component must use `client:only="react"` in Astro:
```astro
<App client:only="react" />
```

## Development Workflow

1. Run dev server: `npm run dev`
2. Open `http://localhost:4321`
3. Edit files - hot reload works for most changes
4. Build: `npm run build`

## File Organization

- `src/pages/index.astro` - Entry point, renders App with `client:only`
- `src/layouts/Layout.astro` - Base HTML with meta tags, imports Leaflet CSS
- `src/components/App.tsx` - Root React component with tab state
- `src/components/Header.tsx` - Tab navigation
- `src/components/MapView/` - Map components (MapView, FilterPanel, ChurchPopup)
- `src/components/ListView/` - List components (ListView, DataTable, FilterCard)
- `src/hooks/useChurches.ts` - Data fetching hook
- `src/types/church.ts` - TypeScript interfaces
- `src/utils/` - Utilities (formatting, filtering, constants)
- `src/styles/global.css` - Tailwind imports + custom Leaflet popup styles
- `public/churches.json` - **Single source of truth** for all church data

## Modifying Church Data

When editing `public/churches.json`:
- Maintain all required fields (arrays can be empty `[]` but must exist)
- Coordinates: `[latitude, longitude]` format
- Times: Always use `HHMM` 24-hour format strings
- Optional `note` field can be added to mass/confession/adoration objects
- Phone: Include `+1` prefix (formatted by `formatPhoneNumber()`)

## Styling

- Use Tailwind utility classes for all styling
- Custom styles for Leaflet popups in `src/styles/global.css`
- Responsive: Mobile-first, use `md:` and `lg:` breakpoints
- Filter panel uses z-index `z-[1000]`+ to appear above Leaflet map

## Accessibility

The codebase follows accessibility best practices:
- ARIA labels on interactive elements (`aria-label`, `aria-labelledby`)
- Role attributes (`role="tabpanel"`, `role="dialog"`)
- `aria-hidden` for inactive tab panels
- `sr-only` class for screen reader-only content
- Semantic HTML and keyboard navigation

## Deployment

Static site hosted on GitHub Pages. The `CNAME` file defines the custom domain (`mass.bornais.ca`). Push to `main` branch deploys automatically via Astro build.

## Common Tasks

**Add a new church**: Edit `public/churches.json`, add object with all required fields
**Change map center**: Edit `MAP_CENTER` in `src/utils/constants.ts`
**Modify filter options**: Update `TIME_OPTIONS` or `DAYS_OF_WEEK` in `src/utils/constants.ts`
**Style changes**: Use Tailwind classes or edit `src/styles/global.css`
