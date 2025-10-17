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

This project uses a **zero-build, vanilla ES modules** architecture:

- **[Preact](https://preactjs.com/)**: Lightweight React alternative for component-based UI
  - [Documentation](https://preactjs.com/guide/v10/getting-started)
  - [Hooks API](https://preactjs.com/guide/v10/hooks)
- **[HTM](https://github.com/developit/htm)**: JSX-like syntax using template literals (no build step)
  - [Documentation](https://github.com/developit/htm#readme)
- **[Leaflet](https://leafletjs.com/)**: Interactive maps with OpenStreetMap
  - [Documentation](https://leafletjs.com/reference.html)
  - [Tutorials](https://leafletjs.com/examples.html)
- **[Bootstrap 5](https://getbootstrap.com/)**: CSS-only styling (no Bootstrap JS)
  - [Documentation](https://getbootstrap.com/docs/5.3/getting-started/introduction/)
  - [Utilities](https://getbootstrap.com/docs/5.3/utilities/api/)
- **No bundler/transpiler**: Pure ES modules run directly in the browser

All dependencies are vendored - no npm install required!

## Getting Started

### Prerequisites

- Any HTTP server (Python, Node.js http-server, VS Code Live Server, etc.)
- A modern web browser with ES module support

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/jere-mie/massfinder-we.git
   cd massfinder-we
   ```

2. **Start a local server**
   
   Using Python:
   ```bash
   python3 -m http.server 8000
   ```
   
   Or using Node.js:
   ```bash
   npx http-server -p 8000
   ```

3. **Open in browser**
   ```
   http://localhost:8000
   ```

4. **Make changes**
   - Edit files in the `static/` directory
   - Refresh browser to see changes (no build step!)

### Project Structure

```
massfinder-we/
├── index.html                      # Entry point
├── CNAME                          # Custom domain config
├── static/
│   ├── churches.json              # Church data (single source of truth)
│   ├── main.js                    # App bootstrap
│   ├── utils.js                   # Shared utilities
│   ├── style.css                  # Custom styles
│   ├── standalone-preact.esm.js   # Vendored Preact + HTM
│   ├── components/                # Preact components
│   │   ├── App.js                 # Root component
│   │   ├── Header.js              # Navigation tabs
│   │   ├── MapTab.js              # Map view
│   │   ├── ListTab.js             # Table view
│   │   └── FiltersOffcanvas.js    # Filter sidebar
│   ├── leaflet/                   # Vendored Leaflet library
│   └── bootstrap/                 # Vendored Bootstrap CSS
```

## Development Guidelines

### Adding a New Church

Edit `static/churches.json` with the following structure:

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
- Get coordinates from Google Maps (right-click location)
- Optional `note` field available for all time entries

### Component Development

Components use HTM (JSX-like) syntax with Preact:

```javascript
import { html } from '../standalone-preact.esm.js';
import { useState, useEffect } from '../standalone-preact.esm.js';

export function MyComponent({ prop }) {
  const [state, setState] = useState(initialValue);
  
  return html`
    <div class="${state ? 'active' : ''}">
      <${ChildComponent} value=${prop} />
    </div>
  `;
}
```

**Key patterns:**
- Use `html` tagged template literals (not JSX)
- Components use `.js` extension (not `.jsx`)
- Props interpolation: `${value}` for expressions
- Component composition: `<${ComponentName} />`

### Utility Functions

Common utilities in `static/utils.js`:

- `formatTime(time)` - Convert `"1830"` → `"6:30 PM"`
- `formatPhoneNumber(phone)` - Format to `"(519) 736-5418"`
- `formatUrl(url)` - Strip protocol and trailing slash
- `sortMasses(masses)` - Sort by day then time
- `DAYS_OF_WEEK` - Ordered array of day names
- `TIME_OPTIONS` - Time select options

### Styling

- Use Bootstrap utility classes when possible
- Custom styles in `static/style.css`
- Follow existing patterns for consistency
- Test responsive behavior on mobile

### Accessibility

Maintain ARIA attributes and semantic HTML:
- Add `aria-label` to interactive elements
- Use `role` attributes appropriately
- Maintain keyboard navigation
- Test with screen readers when possible

## Data Maintenance

Church information should be updated regularly to ensure accuracy:

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
- Built with Preact, HTM, Leaflet, and Bootstrap
