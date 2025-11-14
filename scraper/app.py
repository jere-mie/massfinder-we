#!/usr/bin/env python3
"""
Main entrypoint for the bulletin analysis application.
Orchestrates scraping, PDF processing, and LLM analysis.
"""

import logging
import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime

# Import utilities
from utils import scraping, llm
from utils.logging_config import setup_logging


def main():
    """Main application flow"""
    parser = argparse.ArgumentParser(
        description='Analyze church bulletins and suggest data updates'
    )
    parser.add_argument(
        '--log-level',
        default='INFO',
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
        help='Logging level (default: INFO)'
    )
    parser.add_argument(
        '--output',
        default='bulletins_analysis.md',
        help='Output markdown file (default: bulletins_analysis.md)'
    )
    parser.add_argument(
        '--churches-path',
        default='../static/churches.json',
        help='Path to churches.json (default: ../static/churches.json)'
    )
    
    args = parser.parse_args()
    
    # Setup logging
    log_level = getattr(logging, args.log_level)
    logger = setup_logging(log_level)
    logger.info(f"Starting bulletin analysis (log level: {args.log_level})")
    
    # Resolve paths
    script_dir = Path(__file__).parent
    churches_path = script_dir / args.churches_path
    bulletins_dir = script_dir / 'bulletins'
    output_path = script_dir / args.output
    
    # Verify churches.json exists
    if not churches_path.exists():
        logger.error(f"churches.json not found at {churches_path}")
        return 1
    
    logger.info(f"Using churches.json from {churches_path}")
    
    # Step 1: Load churches data
    try:
        churches = scraping.load_churches_json(str(churches_path))
        logger.info(f"Loaded {len(churches)} churches")
    except Exception as e:
        logger.error(f"Failed to load churches: {e}")
        return 1
    
    # Step 2: Scrape bulletin links with caching
    try:
        website_cache = scraping.get_bulletin_links(churches)
    except Exception as e:
        logger.error(f"Failed to scrape bulletin links: {e}")
        return 1
    
    # Step 3: Download bulletins
    try:
        downloaded = scraping.download_all_pdfs(website_cache, str(bulletins_dir))
        logger.info(f"Downloaded {len(downloaded)} bulletins")
    except Exception as e:
        logger.error(f"Failed to download bulletins: {e}")
        return 1
    
    if not downloaded:
        logger.warning("No bulletins downloaded. Exiting.")
        return 0
    
    # Step 4: Analyze each bulletin with LLM and collect results
    logger.info("Analyzing bulletins with LLM...")
    all_suggestions = []
    
    for website, pdf_path in downloaded:
        # Find matching church(es) for this bulletin website
        matching_churches = [
            c for c in churches 
            if c.get('bulletin_website') == website
        ]
        
        if not matching_churches:
            logger.warning(f"No church found for website {website}, skipping")
            continue
        
        # Analyze PDF
        extracted = llm.analyze_bulletin(pdf_path, churches)
        
        if extracted:
            # Generate suggestions for each matching church
            for church in matching_churches:
                suggestions = llm.compare_to_churches(extracted, church)
                all_suggestions.append(suggestions)
        else:
            logger.warning(f"Failed to analyze PDF for {website}")
    
    # Step 5: Write results to markdown file
    try:
        write_analysis_report(output_path, all_suggestions)
        logger.info(f"Analysis complete. Results saved to {output_path}")
    except Exception as e:
        logger.error(f"Failed to write analysis report: {e}")
        return 1
    
    # Cleanup: remove temporary bulletin files (optional)
    # import shutil
    # shutil.rmtree(bulletins_dir, ignore_errors=True)
    # logger.debug(f"Cleaned up {bulletins_dir}")
    
    return 0


def write_analysis_report(output_path, suggestions):
    """Write analysis suggestions to markdown file"""
    logger = logging.getLogger(__name__)
    logger.info(f"Writing analysis report to {output_path}")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(f"# Bulletin Analysis Report\n\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write(f"## Summary\n\n")
        f.write(f"Total churches analyzed: {len(suggestions)}\n")
        f.write(f"Churches with suggested changes: {sum(1 for s in suggestions if s['changes'])}\n\n")
        
        f.write(f"## Detailed Suggestions\n\n")
        
        for suggestion in suggestions:
            f.write(f"### {suggestion['name']}\n\n")
            
            if not suggestion['changes']:
                f.write("✓ No changes suggested.\n\n")
            else:
                for change in suggestion['changes']:
                    field = change['field']
                    current = change['current']
                    suggested = change['suggested']
                    
                    f.write(f"**{field}**\n\n")
                    f.write(f"Current:\n```json\n{json.dumps(current, indent=2)}\n```\n\n")
                    f.write(f"Suggested:\n```json\n{json.dumps(suggested, indent=2)}\n```\n\n")
        
        f.write(f"---\n\nEnd of report.\n")


if __name__ == '__main__':
    sys.exit(main())