# SQLite data architecture

The site uses one normalized SQLite database at `public/massfinder.db`. The database is a static asset so the existing Astro/GitHub Pages deployment remains static. Browser React islands load the file once with SQLite WASM and query it through `src/lib/databaseClient.ts`.

## Schema

`database/schema.sql` is the source of truth. All records use text UIDs as primary keys; the schema contains no autoincrementing numeric IDs.

- `churches`: identity, contact information, coordinates, and visibility.
- `mass_schedules`: regular and daily Mass times.
- `time_ranges`: confession and adoration windows.
- `offices` and `office_hours`: parish office details and opening hours.
- `events` and `event_tags`: bulletin events and their normalized tags.
- `mass_intentions` and `intention_entries`: Mass intention records and individual requests.

SQLite booleans are stored as `INTEGER` values (`0`/`1`), coordinates are separate `REAL` columns, nullable JSON values become nullable `TEXT`/`INTEGER` columns, and arrays are represented by child tables. The frontend query layer reassembles those rows into the existing UI-facing TypeScript objects.

## Data flow

```text
scraper/app.py
    └── scraper/utils/database.py
            └── public/massfinder.db
                    ├── browser SQLite WASM queries
                    └── Astro build-time queries for static pages
```

The frontend does not fetch or parse the old JSON files. `useChurches`, `useEvents`, and `useIntentions` all use the shared database client. Parish detail pages, the parish index, and the sitemap use the same database at build time.

## Incremental loading

The event and intention list views query SQLite in bounded pages instead of loading their complete history:

- Upcoming records load first in pages of 24 events or 32 Mass-intention records.
- An intersection observer fetches the next future page as the user approaches the bottom.
- An upward “Load earlier” control fetches older records in the same page sizes using stable date/UID cursors.
- Event calendar navigation queries only the visible calendar month, with filter predicates applied in SQLite.

Search, parish, tag, and date filters are included in the SQL query, so pagination remains correct even when filters are changed.

When a search term is at least two characters long, the list switches to a database-wide search query: the search predicate is applied before pagination, and matching past and future records are paged from SQLite as the user scrolls. A one-character term does not query the database. Search input is debounced, capped at 100 characters, and escaped as a literal `LIKE` substring.

## Browser SQLite practices

The browser keeps one shared in-memory read-only database handle per page. The database client loads the WASM runtime and binary concurrently, revalidates the static database asset, validates `PRAGMA user_version`, and retries initialization after transient failures. UI components cannot access the raw SQLite handle; they use typed, parameterized query functions instead.

Query results use a small bounded cache because the shipped database is immutable for the lifetime of a page. Stale cache entries are evicted, failed queries are removed, and callers receive array copies so one component cannot mutate another component's cached result. Text searches are debounced before querying the synchronous WASM database.

## Scraper usage

From the `scraper` directory:

```bash
python app.py --mode mass --modify-db
python app.py --mode events --modify-db
python app.py --mode intentions --modify-db
```

The default database path is `../public/massfinder.db`. Use `--database-path` to point at another database. `--modify-json` remains accepted as a compatibility alias for older workflow commands, but it writes SQLite now.

The scraper uses Python's standard-library `sqlite3` module. It enables foreign keys and WAL mode, reads normalized data for bulletin/LLM context, and writes each data family transactionally.

The initial JSON-to-SQLite migration has been completed. Future updates should go through the scraper and database utilities above. Generated database updates should be reviewed as binary SQLite changes and validated with the application build.
