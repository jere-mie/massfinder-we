"""
LLM interaction utilities for analyzing church bulletins.
Compares bulletin PDFs to existing church JSON data and returns markdown.
Now supports image-based analysis for better accuracy.
"""

import base64
import json
import os
import io
import time
import logging
import requests
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load environment variables from .env
load_dotenv()

# Read OpenRouter configuration from environment to allow overrides
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
# Allow the API URL to be overridden via env (fixes 404 when provider URL differs)
OPENROUTER_API_URL = os.getenv('OPENROUTER_API_URL', 'https://openrouter.ai/api/v1/chat/completions')

# Validate API key early so the user gets a clear error when it's missing
if not OPENROUTER_API_KEY:
    logger.error("OPENROUTER_API_KEY is not set. Set it in .env or the environment.")
    raise RuntimeError(
        "OPENROUTER_API_KEY is not set. Please set it in your environment or .env file "
        "before running the bulletin analyzer."
    )
# Model options: prefer faster models for bulk processing
PREFERRED_MODEL = 'google/gemini-3.1-flash-lite-preview'
FALLBACK_MODEL = 'google/gemini-2.5-flash-lite'

# Retry configuration
MAX_RETRIES = 3
RETRY_DELAY = [2, 5, 10]  # Seconds to wait between retries

# Import PDF to images conversion
from .pdf_to_images import convert_pdf_to_images


def _make_api_request(url, headers, payload, timeout, context=""):
    """
    Make API request with retry logic for 502/503 errors.
    
    Args:
        url: API endpoint URL
        headers: Request headers
        payload: Request payload
        timeout: Request timeout in seconds
        context: Context string for logging (e.g., church names)
    
    Returns:
        Response JSON dict or None on failure
    """
    for attempt in range(MAX_RETRIES):
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=timeout)
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.HTTPError as e:
            # Retry on 502/503 errors (server issues)
            if response.status_code in [502, 503]:
                if attempt < MAX_RETRIES - 1:
                    delay = RETRY_DELAY[attempt]
                    logger.warning(f"⚠ {response.status_code} error for {context}, retrying in {delay}s (attempt {attempt + 1}/{MAX_RETRIES})")
                    time.sleep(delay)
                    continue
                else:
                    logger.error(f"API request failed after {MAX_RETRIES} retries for {context}: {response.status_code} {e}")
                    return None
            else:
                # Don't retry other HTTP errors (401, 429, etc.)
                # Log response body for debugging (helps diagnose 404 endpoint mismatches)
                body = None
                try:
                    body = response.text
                except Exception:
                    body = '<unavailable>'
                logger.error(f"API request failed for {context}: {response.status_code} {e} - response body: {body[:500]}")
                return None
                
        except requests.exceptions.Timeout:
            if attempt < MAX_RETRIES - 1:
                delay = RETRY_DELAY[attempt]
                logger.warning(f"⚠ Timeout for {context}, retrying in {delay}s (attempt {attempt + 1}/{MAX_RETRIES})")
                time.sleep(delay)
                continue
            else:
                logger.error(f"API request timed out after {MAX_RETRIES} retries for {context}")
                return None
                
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed for {context}: {str(e)[:100]}")
            return None
    
    return None


def _encode_image_to_base64(image):
    """
    Encode an image (PIL Image or file path) to base64 data URL.
    """
    from PIL import Image
    
    if isinstance(image, str):
        # It's a file path
        with open(image, 'rb') as f:
            img_bytes = f.read()
    else:
        # It's a PIL Image
        buffer = io.BytesIO()
        image.save(buffer, format='PNG')
        img_bytes = buffer.getvalue()
    
    img_base64 = base64.b64encode(img_bytes).decode('utf-8')
    return f"data:image/png;base64,{img_base64}"


def _build_image_content(images, prompt_text):
    """
    Build the content array for multi-image LLM request.
    """
    content = [{'type': 'text', 'text': prompt_text}]
    
    for i, img in enumerate(images):
        data_url = _encode_image_to_base64(img)
        content.append({
            'type': 'image_url',
            'image_url': {
                'url': data_url,
                'detail': 'high'
            }
        })
    
    return content


def analyze_bulletin(pdf_path, churches_data, model=None, use_images=True):
    """
    Send a bulletin PDF to the LLM and ask it to compare against existing church data.
    Returns markdown with any differences found, or empty string if no differences.
    
    Args:
        pdf_path: Path to the bulletin PDF file
        churches_data: Either a single church dict or a list of church dicts that share this bulletin
        model: Optional model to use (overrides PREFERRED_MODEL)
        use_images: If True, convert PDF to images for analysis (recommended for accuracy)
    
    Returns:
        Markdown string with differences (empty if no differences), or None on error
    """
    if not os.path.exists(pdf_path):
        logger.error(f"PDF not found: {pdf_path}")
        return None
    
    # Use provided model or fall back to preferred model
    model_to_use = model if model else PREFERRED_MODEL
    
    # Ensure we have a list
    if isinstance(churches_data, dict):
        churches_list = [churches_data]
    else:
        churches_list = churches_data
    
    church_names = ', '.join([c.get('name', 'Unknown') for c in churches_list])
    
    try:
        # Prepare the comparison prompt
        prompt = f"""ONLY OUTPUT FINAL TABLES. NO EXPLANATIONS. NO PREAMBLE.

Database:
{json.dumps(churches_list, indent=2)}

Compare the bulletin images to database. Output ONLY:

"NO DIFFERENCES" if all times match exactly.

OR table format with ONLY actual differences:

### Church Name

| Field | Bulletin | Database | Page | Note |
|-------|----------|----------|------|------|
| Saturday Mass | 1700 | 1730 | 1 | Optional |

RULES:
- Only include rows where Bulletin value DIFFERS from Database value
- Do NOT include rows where both are empty/missing
- Do NOT include rows where both match
- ALWAYS convert all times to 4-digit 24-hour format (e.g., 5:30 PM -> 1730, 9:45 AM -> 0945)
- Be concise in Note field
- Page number required (based on image order, starting from 1)
- Ignore any non-mass/adoration/confession events
- Ignore any special events/holidays
- Ignore 'memorial masses' as they are not regular schedule
- No text before or after tables"""

        if use_images:
            # Convert PDF to images
            images = convert_pdf_to_images(pdf_path, max_pages=6)  # Limit to first 6 pages
            
            if not images:
                logger.warning(f"Failed to convert PDF to images, falling back to PDF mode: {pdf_path}")
                return _analyze_bulletin_pdf(pdf_path, churches_list, prompt, model_to_use, church_names)
            
            logger.info(f"Analyzing {len(images)} page images for: {church_names}")
            
            # Build multi-image content
            content = _build_image_content(images, prompt)
            
            payload = {
                'model': model_to_use,
                'messages': [{'role': 'user', 'content': content}],
                'reasoning': {
                    'max_tokens': 3000,
                    'exclude': True,
                    'enabled': True
                }
            }
        else:
            # Fall back to PDF mode
            return _analyze_bulletin_pdf(pdf_path, churches_list, prompt, model_to_use, church_names)
        
        # Call OpenRouter API
        headers = {
            'Authorization': f'Bearer {OPENROUTER_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        result = _make_api_request(OPENROUTER_API_URL, headers, payload, 180, church_names)
        
        if result is None:
            return None
        
        # Extract response content
        if 'choices' in result and len(result['choices']) > 0:
            content = result['choices'][0]['message']['content'].strip()
            
            logger.debug(f"LLM Raw Response:\n{content}")
            
            # Check if no differences
            if content == "NO DIFFERENCES":
                logger.info(f"✓ No differences found for: {church_names}")
                return ""  # Return empty string for no differences
            
            # Return the markdown response
            logger.info(f"✓ Found differences for: {church_names}")
            return content
        else:
            logger.error(f"No response from LLM for: {church_names}")
            return None
    
    except Exception as e:
        logger.error(f"Error analyzing bulletin for {church_names}: {str(e)[:100]}")
        return None


def _analyze_bulletin_pdf(pdf_path, churches_list, prompt, model_to_use, church_names):
    """
    Legacy PDF-based analysis (fallback when image conversion fails).
    """
    try:
        # Encode PDF as base64
        with open(pdf_path, 'rb') as f:
            pdf_base64 = base64.b64encode(f.read()).decode('utf-8')
        
        data_url = f"data:application/pdf;base64,{pdf_base64}"
        
        logger.info(f"Analyzing PDF (fallback mode) for: {church_names}")
        
        headers = {
            'Authorization': f'Bearer {OPENROUTER_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        # Build payload for PDF upload fallback
        payload = {
            'model': model_to_use,
            'messages': [
                {
                    'role': 'user',
                    'content': [
                        {'type': 'text', 'text': prompt},
                        {
                            'type': 'file',
                            'file': {
                                'filename': 'bulletin.pdf',
                                'file_data': data_url
                            }
                        }
                    ]
                }
            ],
            'reasoning': {
                'max_tokens': 3000,
                'exclude': True,
                'enabled': True
            }
        }

        result = _make_api_request(OPENROUTER_API_URL, headers, payload, 120, church_names)
        
        if result is None:
            return None
        
        if 'choices' in result and len(result['choices']) > 0:
            content = result['choices'][0]['message']['content'].strip()
            
            if content == "NO DIFFERENCES":
                logger.info(f"✓ No differences found for: {church_names}")
                return ""
            
            logger.info(f"✓ Found differences for: {church_names}")
            return content
        else:
            logger.error(f"No response from LLM for: {church_names}")
            return None
            
    except Exception as e:
        logger.error(f"PDF analysis failed for {church_names}: {str(e)[:100]}")
        return None


def update_churches_from_markdown(churches_data, markdown_report, markdown_results, model=None):
    """
    Use LLM to analyze the markdown report and update churches.json accordingly.
    
    Args:
        churches_data: List of church dictionaries (the current churches.json)
        markdown_report: The full markdown report content generated by analysis
        markdown_results: Dict of bulletin websites and their analysis results
        model: Optional model to use (overrides PREFERRED_MODEL)
    
    Returns:
        Updated list of church dictionaries with modifications applied
    """
    logger = logging.getLogger(__name__)
    
    try:
        logger.info("Sending churches.json and analysis report to LLM for updates...")
        
        # Use provided model or fall back to preferred model
        model_to_use = model if model else PREFERRED_MODEL
        
        # Prepare the update prompt
        prompt = f"""You are a JSON data manager for a Catholic church database. 

CURRENT churches.json:
{json.dumps(churches_data, indent=2)}

ANALYSIS REPORT (differences found between bulletins and database):
{markdown_report}

TASK: Review the analysis report and update the churches.json to correct any discrepancies found in the bulletins.

RULES:
1. Only modify fields that have CONFIRMED differences in the analysis report
2. Use exact times from the bulletin (in HHMM 24-hour format)
3. Maintain all existing fields and structure
4. Do NOT invent or assume data not in the report
5. Return ONLY valid JSON, no explanations

EXAMPLE CHANGE:
If report shows "Saturday Mass | 1700 | 1730 | Page 1", change the Saturday mass from 1730 to 1700 in the church's masses array.

OUTPUT: Return ONLY the complete updated churches.json as valid JSON array. No markdown, no explanations."""

        headers = {
            'Authorization': f'Bearer {OPENROUTER_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'model': model_to_use,
            'messages': [
                {
                    'role': 'user',
                    'content': prompt
                }
            ],
            'timeout': 120
        }
        
        result = _make_api_request(OPENROUTER_API_URL, headers, payload, 120, "JSON update")
        
        if result is None:
            return churches_data
        
        if 'choices' in result and len(result['choices']) > 0:
            content = result['choices'][0]['message']['content'].strip()
            
            # Extract JSON from response (in case there's any extra text)
            import re
            json_match = re.search(r'\[.*\]', content, re.DOTALL)
            
            if json_match:
                json_str = json_match.group(0)
                updated_churches = json.loads(json_str)
                logger.info(f"✓ Successfully generated updated churches data")
                return updated_churches
            else:
                logger.error("LLM response did not contain valid JSON array")
                return churches_data
        else:
            logger.error("No response from LLM for JSON update")
            return churches_data
    
    except requests.exceptions.RequestException as e:
        logger.error(f"API request failed for JSON update: {str(e)[:100]}")
        return churches_data
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM response as JSON: {str(e)[:100]}")
        return churches_data
    except Exception as e:
        logger.error(f"Error updating churches from markdown: {str(e)[:100]}")
        return churches_data


def extract_events_from_bulletin(pdf_path, churches_data, existing_events, model=None, use_images=True):
    """
    Extract upcoming events from a bulletin PDF using LLM.
    
    Args:
        pdf_path: Path to the bulletin PDF file
        churches_data: List of church dicts that share this bulletin (simplified, with id, name, familyOfParishes)
        existing_events: List of existing events for this family (simplified, for deduplication)
        model: Optional model to use (overrides PREFERRED_MODEL)
        use_images: If True, convert PDF to images for analysis (recommended for accuracy)
    
    Returns:
        List of event dicts extracted from the bulletin, or None on error.
        Events that match existing ones will have the same 'id'.
        New events will have 'id': None.
    """
    from datetime import datetime
    
    if not os.path.exists(pdf_path):
        logger.error(f"PDF not found: {pdf_path}")
        return None
    
    # Use provided model or fall back to preferred model
    model_to_use = model if model else PREFERRED_MODEL
    
    church_names = ', '.join([c.get('name', 'Unknown') for c in churches_data])
    family_of_parishes = None
    for c in churches_data:
        if c.get('familyOfParishes'):
            family_of_parishes = c.get('familyOfParishes')
            break
    
    try:
        current_date = datetime.now().strftime('%Y-%m-%d')
        
        # Prepare the events extraction prompt
        prompt = f"""You are extracting UPCOMING SPECIAL EVENTS from a Catholic parish bulletin.

CHURCHES IN THIS BULLETIN:
{json.dumps(churches_data, indent=2)}

EXISTING EVENTS (from previous extractions - use for deduplication):
{json.dumps(existing_events, indent=2) if existing_events else "[]"}

CURRENT DATE: {current_date}

TASK: Extract ONLY special one-time or limited-time events. Look for:
- Parish social events (dinners, breakfasts, potlucks, picnics)
- Fundraisers and sales (bake sales, bazaars, raffles)
- Educational programs (Bible studies, RCIA sessions, workshops, retreats)
- Community outreach (food drives, volunteer events)
- Meetings (parish council, ministry meetings, info sessions)
- Seasonal celebrations (Christmas concerts, Advent programs, Lenten missions)
- Special liturgies with a SPECIFIC DATE (e.g., "Advent Penance Service on Dec 15")

DO NOT INCLUDE (these are handled separately):
- Regular weekly Mass schedules (Sunday Mass, Saturday Vigil, weekday Masses)
- Regular weekly Confession/Reconciliation times
- Regular weekly Adoration/Holy Hour schedules
- Daily Mass schedules
- Any recurring weekly activity without a specific one-time date
- General statements like "Confession available before Mass"

OUTPUT FORMAT (JSON array):
[
  {{
    "id": "existing_id_if_match_or_null",
    "title": "Event Name",
    "description": "Brief description",
    "church_id": "church-slug-or-null",
    "church_name": "Church Name or null",
    "family_of_parishes": "{family_of_parishes or 'Unknown'}",
    "date": "YYYY-MM-DD",
    "start_time": "HHMM or null",
    "end_time": "HHMM or null",
    "location": "Specific location or null",
    "tags": ["category1", "category2"]
  }}
]

PREDEFINED CATEGORIES (select one or more per event):
1. community - Community outreach, food drives, volunteer events
2. education - Bible studies, RCIA sessions, workshops, seminars
3. fundraiser - Bake sales, bazaars, raffles, fundraising events
4. liturgy - Special liturgies with a specific date (Advent service, Lenten mission, Stations of the Cross, etc.)
5. meeting - Parish council, ministry meetings, info sessions
6. retreat - Parish retreats, spiritual retreats, day of recollection
7. sacramental - Baptism preparation, marriage preparation, confirmation prep
8. seasonal - Christmas concerts, Easter programs, holiday celebrations
9. social - Dinners, breakfasts, potlucks, picnics, social gatherings
10. volunteer - Volunteer opportunities, volunteer recruitment events
11. other - Events that don't fit other categories

RULES:
- ONLY include events with a SPECIFIC DATE (not recurring weekly schedules)
- Convert all dates to YYYY-MM-DD format
- Convert times to 24-hour HHMM format (e.g., 5:30 PM -> 1730, 9:00 AM -> 0900)
- If date year is not specified, assume current year. If the date has already passed this year, assume next year.
- If an event is for a specific church, set church_id and church_name from the CHURCHES list above
- If an event is for the whole family of parishes (or church not specified), set church_id and church_name to null
- DEDUPLICATION: If an event matches one in EXISTING EVENTS (same or very similar title, same date, same church), return the SAME id from existing. For new events, set id to null.
- TAGS: Select one or more categories from the list above. Use lowercase category names (e.g., "community", "social"). An event can have multiple applicable tags (e.g., a fundraising dinner could be ["fundraiser", "social"]).
- Return empty array [] if no special events found
- Return ONLY valid JSON array, no explanations or markdown"""

        if use_images:
            # Convert PDF to images
            images = convert_pdf_to_images(pdf_path, max_pages=8)  # More pages for events
            
            if not images:
                logger.warning(f"Failed to convert PDF to images, falling back to PDF mode: {pdf_path}")
                return _extract_events_pdf(pdf_path, prompt, model_to_use, church_names)
            
            logger.info(f"Extracting events from {len(images)} page images for: {church_names}")
            
            # Build multi-image content
            content = _build_image_content(images, prompt)
            
            payload = {
                'model': model_to_use,
                'messages': [{'role': 'user', 'content': content}],
                'reasoning': {
                    'max_tokens': 5000,
                    'exclude': True,
                    'enabled': True
                }
            }
        else:
            return _extract_events_pdf(pdf_path, prompt, model_to_use, church_names)
        
        # Call OpenRouter API
        headers = {
            'Authorization': f'Bearer {OPENROUTER_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        result = _make_api_request(OPENROUTER_API_URL, headers, payload, 180, church_names)
        
        if result is None:
            return None
        
        # Extract response content
        if 'choices' in result and len(result['choices']) > 0:
            content = result['choices'][0]['message']['content'].strip()
            
            logger.debug(f"LLM Events Raw Response:\n{content}")
            
            # Try to parse JSON from response
            import re
            json_match = re.search(r'\[.*\]', content, re.DOTALL)
            
            if json_match:
                json_str = json_match.group(0)
                events = json.loads(json_str)
                logger.info(f"✓ Extracted {len(events)} events for: {church_names}")
                return events
            elif content.strip() == '[]':
                logger.info(f"✓ No events found for: {church_names}")
                return []
            else:
                logger.warning(f"Could not parse events JSON for: {church_names}")
                logger.debug(f"Response content: {content[:500]}")
                return []
        else:
            logger.error(f"No response from LLM for events extraction: {church_names}")
            return None
    
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse events JSON for {church_names}: {str(e)[:100]}")
        return []
    except Exception as e:
        logger.error(f"Error extracting events for {church_names}: {str(e)[:100]}")
        return None


def _extract_events_pdf(pdf_path, prompt, model_to_use, church_names):
    """
    Legacy PDF-based events extraction (fallback when image conversion fails).
    """
    try:
        with open(pdf_path, 'rb') as f:
            pdf_base64 = base64.b64encode(f.read()).decode('utf-8')
        
        data_url = f"data:application/pdf;base64,{pdf_base64}"
        
        logger.info(f"Extracting events from PDF (fallback mode) for: {church_names}")
        
        headers = {
            'Authorization': f'Bearer {OPENROUTER_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'model': model_to_use,
            'messages': [
                {
                    'role': 'user',
                    'content': [
                        {'type': 'text', 'text': prompt},
                        {
                            'type': 'file',
                            'file': {
                                'filename': 'bulletin.pdf',
                                'file_data': data_url
                            }
                        }
                    ]
                }
            ],
            'reasoning': {
                'max_tokens': 5000,
                'exclude': True,
                'enabled': True
            }
        }
        
        result = _make_api_request(OPENROUTER_API_URL, headers, payload, 120, church_names)
        
        if result is None:
            return None
        
        if 'choices' in result and len(result['choices']) > 0:
            content = result['choices'][0]['message']['content'].strip()
            
            import re
            json_match = re.search(r'\[.*\]', content, re.DOTALL)
            
            if json_match:
                json_str = json_match.group(0)
                events = json.loads(json_str)
                logger.info(f"✓ Extracted {len(events)} events for: {church_names}")
                return events
            elif content.strip() == '[]':
                logger.info(f"✓ No events found for: {church_names}")
                return []
            else:
                logger.warning(f"Could not parse events JSON for: {church_names}")
                return []
        else:
            logger.error(f"No response from LLM for events extraction: {church_names}")
            return None
            
    except Exception as e:
        logger.error(f"PDF events extraction failed for {church_names}: {str(e)[:100]}")
        return None


def extract_intentions_from_bulletin(pdf_path, churches_data, model=None, use_images=True):
    """
    Extract Mass intentions from a bulletin PDF using LLM.
    
    Mass intentions are prayer requests listed in the bulletin for specific Masses.
    For example, a bulletin might list:
      "Tuesday, March 17 – 9:00 AM – Bob Joe, by John Doe"
      "Sunday, March 22 – 11:00 AM – All holy souls in purgatory"
    
    Args:
        pdf_path: Path to the bulletin PDF file
        churches_data: List of church dicts that share this bulletin (with id, name, masses, daily_masses)
        model: Optional model to use (overrides PREFERRED_MODEL)
        use_images: If True, convert PDF to images for analysis
    
    Returns:
        List of intention dicts extracted from the bulletin, or None on error.
        Each dict has: church_id, date, time, intentions (array of {for, by}).
    """
    from datetime import datetime
    
    if not os.path.exists(pdf_path):
        logger.error(f"PDF not found: {pdf_path}")
        return None
    
    model_to_use = model if model else PREFERRED_MODEL
    
    church_names = ', '.join([c.get('name', 'Unknown') for c in churches_data])
    
    try:
        current_date = datetime.now().strftime('%Y-%m-%d')
        
        prompt = f"""You are extracting MASS INTENTIONS from a Catholic parish bulletin.

Mass intentions are specific prayer requests that are offered during a particular Mass.
They are typically listed in the bulletin under headings like "Mass Intentions", "This Week's Intentions",
"Liturgical Schedule", or within the weekly Mass schedule. They often appear in a format like:
  "Tuesday, March 17 – 9:00 AM – †Bob Smith, by John Doe"
  "Sunday 11:00 AM – For all parishioners"
  "Wednesday 9:00 AM – In memory of Jane Doe, requested by the Smith Family"
  "Saturday 5:00 PM – All holy souls in purgatory, especially deceased members"

The "†" symbol (cross/dagger) before a name indicates someone who is deceased.

CHURCHES IN THIS BULLETIN:
{json.dumps(churches_data, indent=2)}

CURRENT DATE: {current_date}

TASK: Extract ALL Mass intentions listed in the bulletin. For each Mass that has intentions listed,
create an entry with the church, date, time, and all intentions for that Mass.

OUTPUT FORMAT (JSON array):
[
  {{
    "church_id": "church-slug-id",
    "date": "YYYY-MM-DD",
    "time": "HHMM",
    "intentions": [
      {{
        "for": "The person or cause the intention is for (e.g., 'Bob Smith' or 'All holy souls in purgatory')",
        "by": "The person or family who requested the intention, or null if not specified"
      }}
    ]
  }}
]

RULES:
- Extract EVERY Mass intention listed, including daily Masses and weekend Masses
- "for" field: The person, group, or cause that the Mass is being offered for. Include the † symbol if present.
- "by" field: The person or family who requested/offered the intention. Set to null if not specified.
- If a Mass has multiple intentions, list them all in the intentions array
- Convert all dates to YYYY-MM-DD format. If the year is not specified, assume the current year ({datetime.now().year}). If the date has already passed this year, assume next year.
- Convert all times to 24-hour HHMM format (e.g., 5:00 PM -> 1700, 9:00 AM -> 0900)
- Use the church_id from the CHURCHES list above. If multiple churches share this bulletin, match each Mass to the correct church based on the schedule or context.
- If you cannot determine which specific church a Mass belongs to, use the first church's id.
- Return empty array [] if no Mass intentions are found in the bulletin
- Return ONLY valid JSON array, no explanations or markdown
- Do NOT confuse "Mass intentions" with general prayer requests / "prayers of the faithful" / intercessions — only extract specific named intentions tied to a specific Mass date and time"""

        if use_images:
            images = convert_pdf_to_images(pdf_path, max_pages=8)
            
            if not images:
                logger.warning(f"Failed to convert PDF to images, falling back to PDF mode: {pdf_path}")
                return _extract_intentions_pdf(pdf_path, prompt, model_to_use, church_names)
            
            logger.info(f"Extracting intentions from {len(images)} page images for: {church_names}")
            
            content = _build_image_content(images, prompt)
            
            payload = {
                'model': model_to_use,
                'messages': [{'role': 'user', 'content': content}],
                'reasoning': {
                    'max_tokens': 5000,
                    'exclude': True,
                    'enabled': True
                }
            }
        else:
            return _extract_intentions_pdf(pdf_path, prompt, model_to_use, church_names)
        
        headers = {
            'Authorization': f'Bearer {OPENROUTER_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        result = _make_api_request(OPENROUTER_API_URL, headers, payload, 180, church_names)
        
        if result is None:
            return None
        
        if 'choices' in result and len(result['choices']) > 0:
            content = result['choices'][0]['message']['content'].strip()
            
            logger.debug(f"LLM Intentions Raw Response:\n{content}")
            
            import re
            json_match = re.search(r'\[.*\]', content, re.DOTALL)
            
            if json_match:
                json_str = json_match.group(0)
                intentions_list = json.loads(json_str)
                total_intentions = sum(len(m.get('intentions', [])) for m in intentions_list)
                logger.info(f"✓ Extracted {len(intentions_list)} Masses with {total_intentions} intentions for: {church_names}")
                return intentions_list
            elif content.strip() == '[]':
                logger.info(f"✓ No intentions found for: {church_names}")
                return []
            else:
                logger.warning(f"Could not parse intentions JSON for: {church_names}")
                logger.debug(f"Response content: {content[:500]}")
                return []
        else:
            logger.error(f"No response from LLM for intentions extraction: {church_names}")
            return None
    
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse intentions JSON for {church_names}: {str(e)[:100]}")
        return []
    except Exception as e:
        logger.error(f"Error extracting intentions for {church_names}: {str(e)[:100]}")
        return None


def _extract_intentions_pdf(pdf_path, prompt, model_to_use, church_names):
    """
    Legacy PDF-based intentions extraction (fallback when image conversion fails).
    """
    try:
        with open(pdf_path, 'rb') as f:
            pdf_base64 = base64.b64encode(f.read()).decode('utf-8')
        
        data_url = f"data:application/pdf;base64,{pdf_base64}"
        
        logger.info(f"Extracting intentions from PDF (fallback mode) for: {church_names}")
        
        headers = {
            'Authorization': f'Bearer {OPENROUTER_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'model': model_to_use,
            'messages': [
                {
                    'role': 'user',
                    'content': [
                        {'type': 'text', 'text': prompt},
                        {
                            'type': 'file',
                            'file': {
                                'filename': 'bulletin.pdf',
                                'file_data': data_url
                            }
                        }
                    ]
                }
            ],
            'reasoning': {
                'max_tokens': 5000,
                'exclude': True,
                'enabled': True
            }
        }
        
        result = _make_api_request(OPENROUTER_API_URL, headers, payload, 120, church_names)
        
        if result is None:
            return None
        
        if 'choices' in result and len(result['choices']) > 0:
            content = result['choices'][0]['message']['content'].strip()
            
            import re
            json_match = re.search(r'\[.*\]', content, re.DOTALL)
            
            if json_match:
                json_str = json_match.group(0)
                intentions_list = json.loads(json_str)
                total_intentions = sum(len(m.get('intentions', [])) for m in intentions_list)
                logger.info(f"✓ Extracted {len(intentions_list)} Masses with {total_intentions} intentions for: {church_names}")
                return intentions_list
            elif content.strip() == '[]':
                logger.info(f"✓ No intentions found for: {church_names}")
                return []
            else:
                logger.warning(f"Could not parse intentions JSON for: {church_names}")
                return []
        else:
            logger.error(f"No response from LLM for intentions extraction: {church_names}")
            return None
            
    except Exception as e:
        logger.error(f"PDF intentions extraction failed for {church_names}: {str(e)[:100]}")
        return None


def verify_intentions_from_bulletin(pdf_path, churches_data, extracted_intentions, model=None, use_images=True):
    """
    Verify previously extracted Mass intentions against the original bulletin.

    Sends the extracted intentions back to the LLM along with the bulletin and
    asks it to check for missing, wrong, or hallucinated entries.

    Args:
        pdf_path: Path to the bulletin PDF file
        churches_data: Simplified list of church dicts (id, name, masses, daily_masses)
        extracted_intentions: The previously extracted intentions list (no metadata fields)
        model: Optional model to use (overrides PREFERRED_MODEL)
        use_images: If True, convert PDF to images for analysis

    Returns:
        Tuple (is_verified: bool, corrected_intentions: list)
        - (True,  extracted_intentions)  if the model confirms everything is correct
        - (False, corrected_list)         if errors were found and a corrected list returned
        - (False, extracted_intentions)  if the LLM call itself failed
    """
    from datetime import datetime
    import re

    if not os.path.exists(pdf_path):
        logger.error(f"PDF not found: {pdf_path}")
        return False, extracted_intentions

    model_to_use = model if model else PREFERRED_MODEL
    church_names = ', '.join([c.get('name', 'Unknown') for c in churches_data])

    try:
        current_date = datetime.now().strftime('%Y-%m-%d')

        prompt = f"""You are verifying extracted Mass intentions against the original parish bulletin.

CHURCHES IN THIS BULLETIN:
{json.dumps(churches_data, indent=2)}

PREVIOUSLY EXTRACTED INTENTIONS:
{json.dumps(extracted_intentions, indent=2)}

CURRENT DATE: {current_date}

TASK: Carefully review the bulletin and verify the extracted intentions above are complete and accurate.

Check for ALL of the following:
1. MISSING entries – Mass intentions in the bulletin that were not extracted
2. WRONG dates – extracted date does not match what the bulletin says
3. WRONG times – extracted time does not match the bulletin (use 24-hour HHMM format)
4. WRONG church_id – intention assigned to the wrong church
5. INCORRECT "for" text – the person/cause is wrong or garbled
6. INCORRECT "by" text – the requester is wrong or should be null
7. HALLUCINATED entries – entries that do not appear in the bulletin at all

OUTPUT RULES:
- If everything is correct and complete: output the single word VERIFIED (no other text)
- If ANY errors exist: output the fully corrected JSON array in the same format as PREVIOUSLY EXTRACTED INTENTIONS, containing ALL entries (not just the changed ones)
- Do NOT output partial corrections – always return the complete corrected list
- Return ONLY valid JSON array or the word VERIFIED – no explanations, no markdown"""

        if use_images:
            images = convert_pdf_to_images(pdf_path, max_pages=8)

            if not images:
                logger.warning(f"Failed to convert PDF to images for verification, falling back to PDF mode: {pdf_path}")
                return _verify_intentions_pdf(pdf_path, prompt, model_to_use, church_names, extracted_intentions)

            logger.info(f"Verifying intentions from {len(images)} page images for: {church_names}")

            content = _build_image_content(images, prompt)

            payload = {
                'model': model_to_use,
                'messages': [{'role': 'user', 'content': content}],
            }
        else:
            return _verify_intentions_pdf(pdf_path, prompt, model_to_use, church_names, extracted_intentions)

        headers = {
            'Authorization': f'Bearer {OPENROUTER_API_KEY}',
            'Content-Type': 'application/json'
        }

        result = _make_api_request(OPENROUTER_API_URL, headers, payload, 180, church_names)

        if result is None:
            logger.error(f"Verification API call failed for: {church_names}")
            return False, extracted_intentions

        if 'choices' in result and len(result['choices']) > 0:
            response_text = result['choices'][0]['message']['content'].strip()

            logger.debug(f"LLM Verification Raw Response:\n{response_text}")

            if response_text == 'VERIFIED':
                logger.info(f"✓ Intentions verified correct (no changes needed) for: {church_names}")
                return True, extracted_intentions

            json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if json_match:
                corrected = json.loads(json_match.group(0))
                total_corrected = sum(len(m.get('intentions', [])) for m in corrected)
                logger.info(f"Corrections applied: {len(corrected)} Masses / {total_corrected} intentions for: {church_names}")
                return False, corrected
            elif response_text.strip() == '[]':
                logger.info(f"Corrections applied: 0 entries for: {church_names}")
                return False, []
            else:
                logger.warning(f"Could not parse verification response for: {church_names}")
                logger.debug(f"Response: {response_text[:500]}")
                return False, extracted_intentions
        else:
            logger.error(f"No response from LLM for verification: {church_names}")
            return False, extracted_intentions

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse verification JSON for {church_names}: {str(e)[:100]}")
        return False, extracted_intentions
    except Exception as e:
        logger.error(f"Error verifying intentions for {church_names}: {str(e)[:100]}")
        return False, extracted_intentions


def _verify_intentions_pdf(pdf_path, prompt, model_to_use, church_names, extracted_intentions):
    """
    Legacy PDF-based intentions verification (fallback when image conversion fails).
    Returns (is_verified: bool, corrected_intentions: list).
    """
    import re

    try:
        with open(pdf_path, 'rb') as f:
            pdf_base64 = base64.b64encode(f.read()).decode('utf-8')

        data_url = f"data:application/pdf;base64,{pdf_base64}"

        logger.info(f"Verifying intentions from PDF (fallback mode) for: {church_names}")

        headers = {
            'Authorization': f'Bearer {OPENROUTER_API_KEY}',
            'Content-Type': 'application/json'
        }

        payload = {
            'model': model_to_use,
            'messages': [
                {
                    'role': 'user',
                    'content': [
                        {'type': 'text', 'text': prompt},
                        {
                            'type': 'file',
                            'file': {
                                'filename': 'bulletin.pdf',
                                'file_data': data_url
                            }
                        }
                    ]
                }
            ],
        }

        result = _make_api_request(OPENROUTER_API_URL, headers, payload, 120, church_names)

        if result is None:
            return False, extracted_intentions

        if 'choices' in result and len(result['choices']) > 0:
            response_text = result['choices'][0]['message']['content'].strip()

            if response_text == 'VERIFIED':
                logger.info(f"✓ Intentions verified correct (no changes needed) for: {church_names}")
                return True, extracted_intentions

            json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if json_match:
                corrected = json.loads(json_match.group(0))
                total_corrected = sum(len(m.get('intentions', [])) for m in corrected)
                logger.info(f"Corrections applied: {len(corrected)} Masses / {total_corrected} intentions for: {church_names}")
                return False, corrected
            elif response_text.strip() == '[]':
                return False, []
            else:
                logger.warning(f"Could not parse verification response for: {church_names}")
                return False, extracted_intentions
        else:
            logger.error(f"No response from LLM for verification: {church_names}")
            return False, extracted_intentions

    except Exception as e:
        logger.error(f"PDF verification failed for {church_names}: {str(e)[:100]}")
        return False, extracted_intentions


def extract_intentions_from_page_batch(labeled_pages, churches_data, model=None):
    """
    Extract Mass intentions from a batch of labeled page images in a single LLM call.

    Designed for cases where all bulletins have intentions on the same page (e.g. page 2).
    Sends all images together so the model can process them in one request.

    Args:
        labeled_pages: list of (filename, PIL_Image) tuples,
                       e.g. [("bulletin_1.pdf", img), ("bulletin_2.pdf", img), ...]
        churches_data: simplified church context (list of dicts with id, name, masses,
                       daily_masses) — already prepared by intentions.prepare_churches_context
        model: optional model override (uses PREFERRED_MODEL if None)

    Returns:
        List of intention dicts in standard format, each with an extra
        "source_bulletin" field identifying the originating bulletin filename.
        Returns None on a total API failure; returns [] if no intentions found.
    """
    from datetime import datetime
    import re

    if not labeled_pages:
        logger.warning("extract_intentions_from_page_batch called with empty labeled_pages")
        return []

    model_to_use = model if model else PREFERRED_MODEL
    church_names = ', '.join([c.get('name', 'Unknown') for c in churches_data])
    current_date = datetime.now().strftime('%Y-%m-%d')
    bulletin_labels = ', '.join([f'"{fn}"' for fn, _ in labeled_pages])

    prompt = f"""You are extracting MASS INTENTIONS from a batch of {len(labeled_pages)} parish bulletin pages.

Each image below is labeled with its source bulletin filename in square brackets (e.g. [bulletin_1.pdf]).
All pages are from the same family of parishes.

CHURCHES IN THIS FAMILY:
{json.dumps(churches_data, indent=2)}

CURRENT DATE: {current_date}

TASK: For EACH labeled image, extract ALL Mass intentions listed on that page.

OUTPUT FORMAT (JSON array — one entry per Mass that has intentions listed):
[
  {{
    "source_bulletin": "bulletin_N.pdf",
    "church_id": "church-slug-id",
    "date": "YYYY-MM-DD",
    "time": "HHMM",
    "intentions": [
      {{
        "for": "The person or cause the Mass is offered for",
        "by": "The requester, or null if not specified"
      }}
    ]
  }}
]

RULES:
- "source_bulletin" MUST exactly match one of: {bulletin_labels}
- Extract EVERY Mass intention visible in each image — do not skip any
- Convert all dates to YYYY-MM-DD. Assume year {datetime.now().year} when not specified.
  If the date appears to have already passed this year, assume next year.
- Convert all times to 24-hour HHMM format (e.g. 5:00 PM → 1700, 9:00 AM → 0900)
- Use church_id from the CHURCHES list above. If multiple churches share this bulletin,
  match each Mass to the correct church based on schedule. If uncertain, use the first church's id.
- The "†" symbol before a name means deceased — include it in the "for" field.
- If a page has no intentions listed, do not emit any entries for that source_bulletin.
- Return empty array [] if no intentions are found in ANY image.
- Return ONLY valid JSON array, no explanations or markdown."""

    # Build content: prompt + interleaved label + image pairs
    content = [{'type': 'text', 'text': prompt}]
    for filename, img in labeled_pages:
        content.append({'type': 'text', 'text': f'[{filename}]'})
        data_url = _encode_image_to_base64(img)
        content.append({
            'type': 'image_url',
            'image_url': {'url': data_url, 'detail': 'high'},
        })

    payload = {
        'model': model_to_use,
        'messages': [{'role': 'user', 'content': content}],
    }

    headers = {
        'Authorization': f'Bearer {OPENROUTER_API_KEY}',
        'Content-Type': 'application/json',
    }

    context = f"batch of {len(labeled_pages)} bulletins ({church_names})"
    result = _make_api_request(OPENROUTER_API_URL, headers, payload, 240, context)

    if result is None:
        logger.error(f"Batch extraction API call failed for: {context}")
        return None

    if 'choices' in result and len(result['choices']) > 0:
        choice = result['choices'][0]
        message = choice.get('message') or {}
        content_field = message.get('content')
        if content_field is None:
            logger.error(f"Batch extraction response missing 'content' field for: {context}. Full response: {json.dumps(result)[:1000]}")
            return None
        response_text = content_field.strip()

        logger.debug(f"Batch extraction raw response:\n{response_text}")

        json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
        if json_match:
            extracted = json.loads(json_match.group(0))
            total_intentions = sum(len(m.get('intentions', [])) for m in extracted)
            logger.info(
                f"✓ Batch extracted {len(extracted)} Masses / {total_intentions} intentions "
                f"from {len(labeled_pages)} bulletin page(s)"
            )
            return extracted
        elif response_text.strip() == '[]':
            logger.info(f"✓ No intentions found in batch of {len(labeled_pages)} bulletins")
            return []
        else:
            logger.warning("Could not parse batch extraction JSON response")
            logger.debug(f"Response: {response_text[:500]}")
            return []
    else:
        logger.error(f"No response from LLM for batch extraction: {context}")
        return None


def verify_intentions_from_page_batch(labeled_pages, churches_data, extracted_batch, model=None):
    """
    Verify batch-extracted intentions against the original labeled page images.

    Sends the same labeled images along with the previously extracted data and asks
    the model to confirm correctness or return a fully corrected replacement list.

    Args:
        labeled_pages: list of (filename, PIL_Image) tuples (same as extraction call)
        churches_data: simplified church context
        extracted_batch: the previously extracted list (with "source_bulletin" fields)
        model: optional model override

    Returns:
        Tuple (is_verified: bool, result_list: list)
        - (True,  extracted_batch)    if the model confirms everything is correct
        - (False, corrected_list)     if errors were found and a corrected list was returned
        - (False, extracted_batch)    if the API call itself failed
    """
    import re

    if not labeled_pages:
        return True, extracted_batch

    model_to_use = model if model else PREFERRED_MODEL
    church_names = ', '.join([c.get('name', 'Unknown') for c in churches_data])
    bulletin_labels = ', '.join([f'"{fn}"' for fn, _ in labeled_pages])

    prompt = f"""You are verifying extracted Mass intentions against the original parish bulletin pages.

CHURCHES:
{json.dumps(churches_data, indent=2)}

PREVIOUSLY EXTRACTED INTENTIONS:
{json.dumps(extracted_batch, indent=2)}

TASK: For each labeled image below, verify that the extracted entries whose
"source_bulletin" matches that image are complete and accurate.

Check for ALL of the following:
1. MISSING entries — intentions visible in the image that were not extracted
2. WRONG dates — extracted date does not match the bulletin
3. WRONG times — extracted time is incorrect (use 24-hour HHMM format)
4. WRONG church_id — intention assigned to the wrong church
5. INCORRECT "for" text — person or cause is wrong or garbled
6. INCORRECT "by" text — requester is wrong, or should be null
7. HALLUCINATED entries — entries that do not appear in any image
8. WRONG source_bulletin — entry attributed to the wrong bulletin file

OUTPUT RULES:
- If everything is correct and complete across ALL images: output the single word VERIFIED
- If ANY errors exist: output the COMPLETE corrected JSON array in the same format as
  PREVIOUSLY EXTRACTED INTENTIONS, containing ALL entries (not just changed ones).
  The "source_bulletin" field MUST be preserved and must be one of: {bulletin_labels}
- Return ONLY the word VERIFIED or a valid JSON array — no explanations, no markdown."""

    # Build content: prompt + interleaved label + image pairs (same order as extraction)
    content = [{'type': 'text', 'text': prompt}]
    for filename, img in labeled_pages:
        content.append({'type': 'text', 'text': f'[{filename}]'})
        data_url = _encode_image_to_base64(img)
        content.append({
            'type': 'image_url',
            'image_url': {'url': data_url, 'detail': 'high'},
        })

    payload = {
        'model': model_to_use,
        'messages': [{'role': 'user', 'content': content}],
    }

    headers = {
        'Authorization': f'Bearer {OPENROUTER_API_KEY}',
        'Content-Type': 'application/json',
    }

    context = f"batch verification of {len(labeled_pages)} bulletins ({church_names})"
    result = _make_api_request(OPENROUTER_API_URL, headers, payload, 240, context)

    if result is None:
        logger.error(f"Batch verification API call failed for: {context}")
        return False, extracted_batch

    if 'choices' in result and len(result['choices']) > 0:
        choice = result['choices'][0]
        message = choice.get('message') or {}
        content_field = message.get('content')
        if content_field is None:
            logger.error(f"Batch verification response missing 'content' field for: {context}. Full response: {json.dumps(result)[:1000]}")
            return False, extracted_batch

        response_text = content_field.strip()

        logger.debug(f"Batch verification raw response:\n{response_text}")

        if response_text == 'VERIFIED':
            logger.info(
                f"✓ Batch of {len(labeled_pages)} bulletins verified correct (no changes needed)"
            )
            return True, extracted_batch

        json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
        if json_match:
            corrected = json.loads(json_match.group(0))
            total_corrected = sum(len(m.get('intentions', [])) for m in corrected)
            logger.info(
                f"Batch corrections applied: {len(corrected)} Masses / "
                f"{total_corrected} intentions"
            )
            return False, corrected
        elif response_text.strip() == '[]':
            logger.info("Batch corrections applied: 0 entries")
            return False, []
        else:
            logger.warning("Could not parse batch verification response")
            logger.debug(f"Response: {response_text[:500]}")
            return False, extracted_batch
    else:
        logger.error(f"No response from LLM for batch verification: {context}")
        return False, extracted_batch