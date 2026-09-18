# Bulletin scraper

The scraper analyzes parish bulletins with an LLM and persists church schedules, events, and Mass intentions to the repository's SQLite database. It no longer reads or writes the removed public JSON data files.

## Setup

```bash
cd scraper
pip install -r requirements.txt
```

Set `OPENROUTER_API_KEY` before running an analysis.

## Commands

```bash
# Analyze Mass schedules and write approved LLM updates to SQLite
python app.py --mode mass --modify-db

# Extract events or Mass intentions and write the merged records to SQLite
python app.py --mode events --modify-db
python app.py --mode intentions --modify-db

# Use a different database path
python app.py --database-path ../public/massfinder.db --mode events --modify-db
```

`--modify-json` remains an alias for `--modify-db` so older automation can be migrated incrementally. Reports are still written as Markdown under `scraper/` and are not part of the application data store.

## Database behavior

The default database is `../public/massfinder.db`. `utils/database.py` initializes `database/schema.sql`, enables foreign keys and WAL mode, and uses text UIDs for every row. Nested JSON arrays are normalized into child tables and reconstructed only when preparing data for the LLM or build-time consumers.
