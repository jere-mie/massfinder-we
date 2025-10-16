# Copilot Instructions for WE Catholic Mass List

## Project Overview

This is a **static website** for finding Catholic Mass times in Windsor-Essex County, Ontario. The app displays church locations on an interactive map and in filterable table views. It's deployed via GitHub Pages (domain: `mass.bornais.ca`).

## Architecture & Tech Stack

**Zero-build, vanilla ES modules approach:**
- **HTM + Preact**: Uses standalone Preact with HTM (JSX-like syntax) via ES modules (`standalone-preact.esm.js`)
- **Leaflet**: Interactive maps with OpenStreetMap tiles (`leaflet-src.esm.js`)
- **Bootstrap**: UI styling (minimal, CSS-only - no Bootstrap JS)
- **No bundler**: All code runs directly in the browser as ES modules

**Component hierarchy:**
```
App (static/components/App.js)
├── Header (tabs navigation)
├── MapTab (Leaflet map + FiltersOffcanvas)
│   └── FiltersOffcanvas (filter sidebar)
└── ListTab (sortable data tables)
```

## Key Data Structures

**Church object** (`static/churches.json`):
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

**Time format**: Always `HHMM` 24-hour strings (e.g., `"1830"` for 6:30 PM). Use `formatTime()` from `utils.js` to display.

## Critical Patterns

### Component Communication
- **Map ↔ List interaction**: `App.js` uses `markerClickRef` (a React ref) to expose the MapTab's marker click handler to ListTab
- When church name clicked in ListTab → switches to map tab → opens that church's popup via the ref
- Pattern: `onMarkerClick` ref set in MapTab, called from ListTab's `onChurchClick`

### Filtering Logic
- MapTab: Filters churches by `filterType` (masses/confession/adoration), day, and time range
- ListTab: Filters by day and section (separate from map filters)
- Filters use `HHMM` string comparison (`>=` and `<=`) for time ranges
- Filter state lives in each tab component, not globally

### Sorting Convention
Day order: `["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]`
Then by time (ascending). See `sortMasses()` and `sortTimeRange()` in `utils.js`.

### HTM Syntax
Use tagged template literals with `html`:
```javascript
import { html } from '../standalone-preact.esm.js';
return html`<div class="${active ? 'active' : ''}">
  <${ChildComponent} prop=${value} />
</div>`;
```

## Development Workflow

**No build step** - edit and refresh browser:
1. Edit files in `static/` directory
2. Serve locally (any HTTP server): `python3 -m http.server 8000`
3. Open `http://localhost:8000` in browser
4. Changes to JS/CSS require browser refresh

**No package.json, no npm** - all dependencies are vendored ES modules.

## File Organization

- `index.html` - Entry point, loads Bootstrap CSS, Leaflet CSS, and `static/main.js`
- `static/main.js` - App bootstrap (renders `<App />`)
- `static/components/` - Preact components (all use `.js` extension)
- `static/utils.js` - Shared utilities (formatting, constants)
- `static/churches.json` - **Single source of truth** for all church data
- `static/standalone-preact.esm.js` - Vendored Preact+HTM bundle
- `static/leaflet/` - Vendored Leaflet library

## Modifying Church Data

When editing `churches.json`:
- Maintain all required fields (arrays can be empty `[]` but must exist)
- Coordinates: `[latitude, longitude]` format
- Times: Always use `HHMM` 24-hour format strings
- Optional `note` field can be added to mass/confession/adoration objects
- Phone: Include `+1` prefix (formatted by `formatPhoneNumber()`)

## Accessibility

The codebase follows accessibility best practices:
- ARIA labels on interactive elements (`aria-label`, `aria-labelledby`)
- Role attributes (`role="tabpanel"`, `role="presentation"`)
- `aria-hidden` for tab panels
- `.visually-hidden` class for screen reader-only content
- Semantic HTML where possible

## Deployment

Static site hosted on GitHub Pages. The `CNAME` file defines the custom domain (`mass.bornais.ca`). Push to `main` branch deploys automatically.

## Common Tasks

**Add a new church**: Edit `static/churches.json`, add object with all required fields
**Change map center**: Edit coordinates in `MapTab.js` L.map().setView() call (currently centered on Windsor-Essex)
**Modify filter options**: Update `TIME_OPTIONS` or `DAYS_OF_WEEK` in `utils.js`
**Style changes**: Edit `static/style.css` or use Bootstrap utility classes
