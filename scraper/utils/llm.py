"""
LLM interaction utilities for analyzing church bulletins.
Compares bulletin PDFs to existing church JSON data and returns markdown.
"""

import base64
import json
import os
import logging
import requests
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load environment variables from .env
load_dotenv()

OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

# Model options: prefer faster models for bulk processing
PREFERRED_MODEL = 'google/gemini-2.5-flash-lite-preview-09-2025'
FALLBACK_MODEL = 'google/gemini-2.5-flash-lite'


def analyze_bulletin(pdf_path, churches_data, model=None):
    """
    Send a bulletin PDF to the LLM and ask it to compare against existing church data.
    Returns markdown with any differences found, or empty string if no differences.
    
    Args:
        pdf_path: Path to the bulletin PDF file
        churches_data: Either a single church dict or a list of church dicts that share this bulletin
        model: Optional model to use (overrides PREFERRED_MODEL)
    
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
        # Encode PDF as base64
        with open(pdf_path, 'rb') as f:
            pdf_base64 = base64.b64encode(f.read()).decode('utf-8')
        
        # Create data URL for OpenRouter
        data_url = f"data:application/pdf;base64,{pdf_base64}"
        
        logger.info(f"Analyzing {os.path.basename(pdf_path)} for: {church_names}")
        
        # Prepare the comparison prompt
        prompt = f"""ONLY OUTPUT FINAL TABLES. NO EXPLANATIONS. NO PREAMBLE.

Database:
{json.dumps(churches_list, indent=2)}

Compare PDF to database. Output ONLY:

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
- Page number required
- Ignore any non-mass/adoration/confession events
- Ignore any special events/holidays
- Ignore 'memorial masses' as they are not regular schedule
- No text before or after tables"""

        # Call OpenRouter API
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
                        {
                            'type': 'text',
                            'text': prompt
                        },
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
              "reasoning": {
                "max_tokens": 3000,
                "exclude": True,
                "enabled": True
            }
        }
        
        response = requests.post(OPENROUTER_API_URL, json=payload, headers=headers, timeout=120)
        response.raise_for_status()
        
        result = response.json()
        
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
    
    except requests.exceptions.RequestException as e:
        logger.error(f"API request failed for {church_names}: {str(e)[:100]}")
        return None
    except Exception as e:
        logger.error(f"Error analyzing bulletin for {church_names}: {str(e)[:100]}")
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
        
        response = requests.post(OPENROUTER_API_URL, json=payload, headers=headers, timeout=120)
        response.raise_for_status()
        
        result = response.json()
        
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


def extract_events_from_bulletin(pdf_path, churches_data, existing_events, model=None):
    """
    Extract upcoming events from a bulletin PDF using LLM.
    
    Args:
        pdf_path: Path to the bulletin PDF file
        churches_data: List of church dicts that share this bulletin (simplified, with id, name, familyOfParishes)
        existing_events: List of existing events for this family (simplified, for deduplication)
        model: Optional model to use (overrides PREFERRED_MODEL)
    
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
        # Encode PDF as base64
        with open(pdf_path, 'rb') as f:
            pdf_base64 = base64.b64encode(f.read()).decode('utf-8')
        
        # Create data URL for OpenRouter
        data_url = f"data:application/pdf;base64,{pdf_base64}"
        
        logger.info(f"Extracting events from {os.path.basename(pdf_path)} for: {church_names}")
        
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
    "tags": ["tag1", "tag2"]
  }}
]

RULES:
- ONLY include events with a SPECIFIC DATE (not recurring weekly schedules)
- Convert all dates to YYYY-MM-DD format
- Convert times to 24-hour HHMM format (e.g., 5:30 PM -> 1730, 9:00 AM -> 0900)
- If date year is not specified, assume current year. If the date has already passed this year, assume next year.
- If an event is for a specific church, set church_id and church_name from the CHURCHES list above
- If an event is for the whole family of parishes (or church not specified), set church_id and church_name to null
- DEDUPLICATION: If an event matches one in EXISTING EVENTS (same or very similar title, same date, same church), return the SAME id from existing. For new events, set id to null.
- Suggested tags: liturgy, social, fundraiser, education, meeting, community, seasonal, other
- Return empty array [] if no special events found
- Return ONLY valid JSON array, no explanations or markdown"""

        # Call OpenRouter API
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
                        {
                            'type': 'text',
                            'text': prompt
                        },
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
            "reasoning": {
                "max_tokens": 5000,
                "exclude": True,
                "enabled": True
            }
        }
        
        response = requests.post(OPENROUTER_API_URL, json=payload, headers=headers, timeout=120)
        response.raise_for_status()
        
        result = response.json()
        
        # Extract response content
        if 'choices' in result and len(result['choices']) > 0:
            content = result['choices'][0]['message']['content'].strip()
            
            logger.debug(f"LLM Events Raw Response:\n{content}")
            
            # Try to parse JSON from response
            import re
            # Look for JSON array in response
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
    
    except requests.exceptions.RequestException as e:
        logger.error(f"API request failed for events extraction ({church_names}): {str(e)[:100]}")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse events JSON for {church_names}: {str(e)[:100]}")
        return []
    except Exception as e:
        logger.error(f"Error extracting events for {church_names}: {str(e)[:100]}")
        return None