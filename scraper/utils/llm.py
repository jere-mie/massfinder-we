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


def analyze_bulletin(pdf_path, churches_data):
    """
    Send a bulletin PDF to the LLM and ask it to compare against existing church data.
    Returns markdown with any differences found, or empty string if no differences.
    
    Args:
        pdf_path: Path to the bulletin PDF file
        churches_data: Either a single church dict or a list of church dicts that share this bulletin
    
    Returns:
        Markdown string with differences (empty if no differences), or None on error
    """
    if not os.path.exists(pdf_path):
        logger.error(f"PDF not found: {pdf_path}")
        return None
    
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
- No text before or after tables"""

        # Call OpenRouter API
        headers = {
            'Authorization': f'Bearer {OPENROUTER_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'model': PREFERRED_MODEL,
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


def update_churches_from_markdown(churches_data, markdown_report, markdown_results):
    """
    Use LLM to analyze the markdown report and update churches.json accordingly.
    
    Args:
        churches_data: List of church dictionaries (the current churches.json)
        markdown_report: The full markdown report content generated by analysis
        markdown_results: Dict of bulletin websites and their analysis results
    
    Returns:
        Updated list of church dictionaries with modifications applied
    """
    logger = logging.getLogger(__name__)
    
    try:
        logger.info("Sending churches.json and analysis report to LLM for updates...")
        
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
            'model': PREFERRED_MODEL,
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