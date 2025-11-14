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
from urllib.parse import quote
from concurrent.futures import ThreadPoolExecutor, as_completed

# Import utilities
from utils import scraping, llm
from utils.logging_config import setup_logging


def analyze_bulletin_task(website, pdf_link, pdf_path, churches_for_bulletin):
    """
    Helper function to analyze a single bulletin.
    Returns (website, pdf_link, markdown, church_names, churches) tuple.
    """
    logger = logging.getLogger(__name__)
    
    # Pass all churches that share this bulletin to the LLM at once
    markdown = llm.analyze_bulletin(pdf_path, churches_for_bulletin)
    church_names = [c.get('name', 'Unknown') for c in churches_for_bulletin]
    
    if markdown is None:
        logger.warning(f"Failed to analyze PDF for churches: {', '.join(church_names)}")
        return (website, pdf_link, None, church_names, churches_for_bulletin)
    elif markdown:  # Only return if there are differences
        logger.info(f"Found differences for: {', '.join(church_names)}")
        return (website, pdf_link, markdown, church_names, churches_for_bulletin)
    else:
        return (website, pdf_link, None, church_names, churches_for_bulletin)


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
    parser.add_argument(
        '--workers',
        type=int,
        default=10,
        help='Number of parallel workers for LLM analysis (default: 10)'
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
    
    # Step 4: Analyze each bulletin with LLM in parallel
    logger.info(f"Analyzing {len(downloaded)} bulletin(s) with LLM (using {args.workers} workers)...")
    markdown_results = {}  # Dict: bulletin_website -> {markdown, church_names, churches, pdf_link}
    
    # Prepare analysis tasks
    tasks = []
    for website, pdf_link, pdf_path in downloaded:
        # Find ALL churches that use this bulletin website
        churches_for_bulletin = [
            c for c in churches 
            if c.get('bulletin_website') == website
        ]
        
        if not churches_for_bulletin:
            logger.warning(f"No church found for website {website}, skipping")
            continue
        
        tasks.append((website, pdf_link, pdf_path, churches_for_bulletin))
    
    # Execute analysis tasks in parallel
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        # Submit all tasks
        futures = {
            executor.submit(analyze_bulletin_task, website, pdf_link, pdf_path, churches_for_bulletin): (website, pdf_link, churches_for_bulletin)
            for website, pdf_link, pdf_path, churches_for_bulletin in tasks
        }
        
        # Process results as they complete
        for future in as_completed(futures):
            try:
                website, pdf_link, markdown, church_names, churches_for_bulletin = future.result()
                
                if markdown:  # Only add if there are differences
                    markdown_results[website] = {
                        'markdown': markdown,
                        'church_names': church_names,
                        'churches': churches_for_bulletin,
                        'pdf_link': pdf_link
                    }
            except Exception as e:
                logger.error(f"Task failed: {e}")
                continue
    
    # Step 5: Write results to markdown file
    try:
        write_analysis_report(output_path, markdown_results)
        logger.info(f"Analysis complete. Results saved to {output_path}")
    except Exception as e:
        logger.error(f"Failed to write analysis report: {e}")
        return 1
    
    # Summary
    if markdown_results:
        logger.info(f"Found {len(markdown_results)} bulletin(s) with differences")
    else:
        logger.info("No differences found across all bulletins ✓")
    
    return 0


def write_analysis_report(output_path, markdown_results):
    """Write markdown results to file, grouped by bulletin website"""
    logger = logging.getLogger(__name__)
    logger.info(f"Writing analysis report to {output_path}")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        # Write header
        f.write("# Bulletin Analysis Report\n\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        # Write summary
        if not markdown_results:
            f.write("## Summary\n\n")
            f.write("✓ No differences found! All bulletins match the database.\n\n")
        else:
            f.write("## Summary\n\n")
            f.write(f"Found differences in **{len(markdown_results)}** bulletin(s).\n\n")
            f.write("## Differences Found\n\n")
            
            # Group and write results by bulletin website
            for website, result in markdown_results.items():
                markdown = result['markdown']
                pdf_link = result.get('pdf_link', website)  # Fall back to website if pdf_link missing
                # URL-encode the link to handle spaces and special characters
                encoded_link = quote(pdf_link, safe=':/?#[]@!$&\'()*+,;=')
                
                # Write bulletin link as main header
                f.write(f"## [Bulletin]({encoded_link})\n\n")
                
                # Write the markdown table(s) which include church names as headers
                f.write(markdown)
                f.write("\n\n")
        
        # Write footer
        f.write("*End of report.*\n")


if __name__ == '__main__':
    sys.exit(main())