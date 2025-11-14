# Bulletin Analysis Application

Automates the process of scraping church bulletin websites, downloading PDFs, and analyzing them with LLM to identify discrepancies with the churches.json database.

## Architecture

```
app.py              - Main orchestrator
├── utils/scraping.py    - Website scraping and PDF downloading
├── utils/llm.py         - LLM interaction for bulletin analysis
└── churches.json        - Church database (from ../static/)
```

## Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure API key:**
   Create a `.env` file in the scraper directory:
   ```
   OPENROUTER_API_KEY=your_api_key_here
   ```

## Usage

**Basic run:**
```bash
python app.py
```

**Advanced options:**
```bash
# Set log level
python app.py --log-level DEBUG

# Custom output file
python app.py --output my_report.md

# Custom churches.json path
python app.py --churches-path /path/to/churches.json
```

## How It Works

### 1. **Load Churches Data**
   - Loads the master churches.json database
   - Tracks all churches with bulletin_website field

### 2. **Scrape Bulletin Links**
   - Visits each unique bulletin_website URL
   - Extracts all PDF links from the page
   - **Prefers:** parishbulletins.com and files.ecatholic.com domains
   - **Retry Logic:** Up to 5 attempts with exponential backoff (1, 2, 4, 8, 16 seconds)
   - **Caching:** Avoids re-scraping the same website (10-15 actual scrapes for 34 churches)
   - **Bot Detection Bypass:** Uses cloudscraper to bypass Cloudflare

### 3. **Download PDFs**
   - Downloads each PDF to a temporary directory (`bulletins/`)
   - Handles download failures gracefully
   - Preserves directory structure for analysis

### 4. **LLM Analysis**
   - Sends each PDF to OpenRouter API (Google Gemini 2.5 Flash by default)
   - Extracts:
     - Mass times (day + time)
     - Confession times (day + start/end)
     - Adoration times (day + start/end)
   - Compares extracted data to churches.json
   - Identifies discrepancies

### 5. **Generate Report**
   - Creates markdown file with all suggestions
   - Groups by church
   - Shows current vs. suggested data in JSON format
   - Ready for manual review before updating churches.json

## Output

**File:** `bulletins_analysis.md`

Contains:
- Summary statistics
- Per-church analysis with suggested changes
- Current data vs. extracted data comparison
- Organized in JSON format for easy parsing

## Data Format

### Input (churches.json)
```json
{
  "name": "St. John the Baptist",
  "masses": [{"day": "Sunday", "time": "0900"}],
  "confession": [{"day": "Saturday", "start": "0945", "end": "1030"}],
  "adoration": [{"day": "Wednesday", "start": "0930", "end": "2130"}]
}
```

### Time Format
- Always 24-hour format: `"HHMM"` (e.g., `"1830"` for 6:30 PM)

## Features

- **Robust Error Handling:** Retry logic with exponential backoff
- **Performance:** Caching prevents re-scraping, processes multiple churches from same site efficiently
- **Bot Detection:** Cloudscraper automatically bypasses Cloudflare protection
- **Logging:** Configurable logging (DEBUG, INFO, WARNING, ERROR)
- **LLM Integration:** Uses OpenRouter for flexible model selection
- **Clean Architecture:** Modular separation of concerns (scraping, LLM, orchestration)

## Logging

Control logging verbosity with `--log-level`:
- `DEBUG` - Detailed execution information
- `INFO` - Normal operation (default)
- `WARNING` - Only warnings and errors
- `ERROR` - Only errors

Example:
```bash
python app.py --log-level DEBUG
```

## API Keys

Uses OpenRouter.ai API. Get a free account at https://openrouter.ai

**Required:** `OPENROUTER_API_KEY` in `.env` file

**Models used:**
- Primary: Google Gemini 2.5 Flash (fast, accurate, low cost)
- Fallback: OpenAI GPT-4 Turbo (if primary unavailable)

## Troubleshooting

### "403 Forbidden" errors
- These are automatically handled by cloudscraper
- If still occurring, check that cloudscraper is properly installed

### "PDF link not found"
- Some websites may have PDFs in non-standard locations
- Check the website manually and add link to bulletin_website field if needed

### LLM API errors
- Verify OPENROUTER_API_KEY is set correctly in .env
- Check your API quota at https://openrouter.ai/account/usage

### No output file generated
- Ensure bulletins_analysis.md is writable
- Check disk space availability
- Review logs for specific errors

## Performance Notes

- **Scraping Time:** ~1-2 minutes (10-15 actual scrapes due to caching)
- **PDF Downloads:** 2-5 minutes (depends on file sizes)
- **LLM Analysis:** 1-3 minutes (depends on PDF complexity)
- **Total Runtime:** ~5-10 minutes

## Future Enhancements

- [ ] Batch LLM requests for faster processing
- [ ] Store analysis results in database
- [ ] Automated updates to churches.json
- [ ] Email notifications for significant changes
- [ ] Web UI for reviewing changes
- [ ] Version control for churches.json changes
