"""
LLM interaction utilities for analyzing church bulletins.
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


def analyze_bulletin(pdf_path, churches_json_data):
    """
    Send a bulletin PDF to the LLM for analysis.
    Returns the LLM's extracted data as a dictionary.
    """
    if not os.path.exists(pdf_path):
        logger.error(f"PDF not found: {pdf_path}")
        return None
    
    try:
        # Encode PDF as base64
        with open(pdf_path, 'rb') as f:
            pdf_base64 = base64.b64encode(f.read()).decode('utf-8')
        
        logger.info(f"Analyzing {os.path.basename(pdf_path)} with LLM")
        
        # Prepare prompt
        prompt = f"""You are analyzing a Catholic church bulletin PDF. 
        
Extract the following information and return ONLY a valid JSON object (no other text):
- mass_times: Array of objects with 'day' and 'time' fields
- confession_times: Array of objects with 'day', 'start_time', 'end_time', and optional 'note' fields
- adoration_times: Array of objects with 'day', 'start_time', 'end_time' fields

Here is the current church data from our database for reference:
{json.dumps(churches_json_data, indent=2)}

Return ONLY valid JSON, no markdown, no code blocks.
Example format:
{{"mass_times": [{{"day": "Sunday", "time": "0900"}}], "confession_times": [], "adoration_times": []}}"""

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
                                "filename": "bulletins_merged.pdf",
                                "file_data": pdf_base64
                            }
                        }
                    ]
                }
            ],
        }
        
        response = requests.post(OPENROUTER_API_URL, json=payload, headers=headers, timeout=120)
        response.raise_for_status()
        
        result = response.json()
        
        # Extract response content
        if 'choices' in result and len(result['choices']) > 0:
            content = result['choices'][0]['message']['content']
            
            # Parse JSON from response
            try:
                extracted = json.loads(content)
                logger.debug(f"✓ Successfully extracted data from {os.path.basename(pdf_path)}")
                return extracted
            except json.JSONDecodeError:
                # Try to extract JSON from the content
                logger.warning(f"Failed to parse JSON response, attempting recovery")
                extracted = extract_json_from_text(content)
                if extracted:
                    return extracted
                return None
        else:
            logger.error("No response from LLM")
            return None
    
    except requests.exceptions.RequestException as e:
        logger.error(f"API request failed: {str(e)[:100]}")
        return None
    except Exception as e:
        logger.error(f"Error analyzing bulletin: {str(e)[:100]}")
        return None


def extract_json_from_text(text):
    """
    Attempt to extract JSON object from text response.
    Handles cases where LLM wraps JSON in markdown code blocks.
    """
    # Remove markdown code blocks if present
    if '```json' in text:
        text = text.split('```json')[1].split('```')[0]
    elif '```' in text:
        text = text.split('```')[1].split('```')[0]
    
    text = text.strip()
    
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.warning("Could not extract JSON from LLM response")
        return None


def compare_to_churches(extracted_data, original_church_data):
    """
    Compare extracted data from bulletin to original church data.
    Returns a dict with suggested updates.
    """
    suggestions = {
        'name': original_church_data.get('name', 'Unknown'),
        'changes': []
    }
    
    if not extracted_data:
        return suggestions
    
    # Check mass times
    if 'mass_times' in extracted_data:
        original_masses = original_church_data.get('masses', [])
        extracted_masses = extracted_data.get('mass_times', [])
        
        if extracted_masses != original_masses:
            suggestions['changes'].append({
                'field': 'masses',
                'current': original_masses,
                'suggested': extracted_masses
            })
    
    # Check confession times
    if 'confession_times' in extracted_data:
        original_confession = original_church_data.get('confession', [])
        extracted_confession = extracted_data.get('confession_times', [])
        
        if extracted_confession != original_confession:
            suggestions['changes'].append({
                'field': 'confession',
                'current': original_confession,
                'suggested': extracted_confession
            })
    
    # Check adoration times
    if 'adoration_times' in extracted_data:
        original_adoration = original_church_data.get('adoration', [])
        extracted_adoration = extracted_data.get('adoration_times', [])
        
        if extracted_adoration != original_adoration:
            suggestions['changes'].append({
                'field': 'adoration',
                'current': original_adoration,
                'suggested': extracted_adoration
            })
    
    return suggestions