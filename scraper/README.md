# Bulletin Analysis Application

Analyzes church bulletins with LLM to identify discrepancies with churches.json database.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Create .env file with API key
echo "OPENROUTER_API_KEY=your_key_here" > .env

# Run analysis
python app.py
```

## Usage

```bash
# Basic
python app.py

# With options
python app.py --log-level DEBUG --workers 8 --output results.md
```

**Options:**
- `--log-level` - DEBUG, INFO (default), WARNING, ERROR
- `--workers` - Parallel workers (default: 10)
- `--output` - Output file (default: bulletins_analysis.md)
- `--churches-path` - Path to churches.json (default: ../static/churches.json)

## How It Works

1. **Load churches.json** - Master database with `bulletin_website` field
2. **Scrape bulletin links** - Extracts PDFs from websites (cached, Cloudflare-safe)
3. **Download PDFs** - Saves to `bulletins/` directory
4. **Analyze with LLM** - Google Gemini 2.5 Flash Lite compares PDF vs. database (parallel)
5. **Generate report** - Markdown output with differences grouped by bulletin

## Output

Creates `bulletins_analysis.md` with:
- Summary of differences found
- Results grouped by bulletin website
- Side-by-side comparison tables (Bulletin | Database)
- Page references and notes

Example:
```markdown
## [Bulletin](https://example.com/bulletin.pdf)

### St. John
| Field | Bulletin | Database | Page |
|---|---|---|---|
| Tuesday Mass | 1800 | 1700 | 1 |
```

## Data Format

churches.json required fields:
```json
{
  "name": "Church Name",
  "bulletin_website": "https://...",
  "masses": [{"day": "Sunday", "time": "0900"}],
  "confession": [{"day": "Saturday", "start": "0945", "end": "1030"}],
  "adoration": [{"day": "Wednesday", "start": "0930", "end": "2130"}]
}
```

Times: 24-hour format `"HHMM"` (e.g., `"1830"` = 6:30 PM)

## Configuration

**Environment Variable:**
```
OPENROUTER_API_KEY=your_api_key_here
```

**LLM Models** (in `utils/llm.py`):
```python
PREFERRED_MODEL = 'google/gemini-2.5-flash-lite-preview-09-2025'
FALLBACK_MODEL = 'google/gemini-2.5-flash-lite'
```

## Features

- **Parallel LLM Analysis** - ThreadPoolExecutor with configurable workers
- **Intelligent Caching** - Avoids re-scraping bulletin websites
- **Cloudflare Bypass** - Automatic bot detection handling
- **Retry Logic** - Exponential backoff (1, 2, 4, 8, 16 sec, max 5 attempts)
- **Colored Logging** - Emoji indicators (🔍 DEBUG, ✓ INFO, ⚠ WARNING, ✗ ERROR)

## Performance

Typical runtime for 34+ churches:
- Scraping: ~14 seconds (heavy caching)
- Downloading: ~10 seconds
- LLM Analysis: ~38 seconds (10 workers)
- Report Generation: <1 second
- **Total: ~1 minute**

Analysis is highly parallelizable - more workers significantly reduce LLM analysis time.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 403 Forbidden | Automatic with cloudscraper, check internet |
| PDF link not found | Verify `bulletin_website` URL manually |
| LLM errors | Check API key in `.env` and quota at openrouter.ai |
| Slow | Increase `--workers` value |
| Debug | Use `--log-level DEBUG` |

## Architecture

```
app.py              - Main orchestrator
├── utils/scraping.py    - Scraping, downloading, caching
├── utils/llm.py         - LLM API interaction
└── utils/logging_config.py - Colored logging
```

## Dependencies

- `requests` - HTTP requests
- `beautifulsoup4` - HTML parsing
- `cloudscraper` - Cloudflare bypass
- `python-dotenv` - Environment variables

See `requirements.txt` for versions.

## API

Uses [OpenRouter.ai](https://openrouter.ai) - free account available.

**Cost:** ~$0.01-0.02 USD per run (34 churches)
