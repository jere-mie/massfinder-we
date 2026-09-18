#!/usr/bin/env python3
"""
Main entrypoint for the bulletin analysis application.
Orchestrates scraping, PDF processing, and LLM analysis.
Supports three modes:
 - 'mass'       : update Mass times
 - 'events'     : extract parish events
 - 'intentions' : extract Mass intentions
When the --output argument is not provided, the default output filenames are:
 - mass mode       -> bulletins_analysis.md
 - events mode     -> events_analysis.md
 - intentions mode -> intentions_analysis.md
"""

import logging
import os
import sys
import argparse
from pathlib import Path
from datetime import datetime
from urllib.parse import quote
from concurrent.futures import ThreadPoolExecutor, as_completed

# Import utilities
from utils import scraping, llm, events, intentions
from utils.database import load_churches, load_events, load_intentions, open_database, replace_churches, replace_events, replace_intentions
from utils.logging_config import setup_logging


def analyze_bulletin_task(website, pdf_link, pdf_path, churches_for_bulletin, model=None, use_images=True):
    """
    Helper function to analyze a single bulletin for mass time differences.
    Returns (website, pdf_link, markdown, church_names, churches) tuple.
    """
    logger = logging.getLogger(__name__)
    
    # Pass all churches that share this bulletin to the LLM at once
    markdown = llm.analyze_bulletin(pdf_path, churches_for_bulletin, model=model, use_images=use_images)
    church_names = [c.get('name', 'Unknown') for c in churches_for_bulletin]
    
    if markdown is None:
        logger.warning(f"Failed to analyze PDF for churches: {', '.join(church_names)}")
        return (website, pdf_link, None, church_names, churches_for_bulletin)
    elif markdown:
        return (website, pdf_link, markdown, church_names, churches_for_bulletin)
    else:
        return (website, pdf_link, None, church_names, churches_for_bulletin)


def extract_events_task(website, pdf_link, pdf_path, churches_for_bulletin, existing_events, model=None, use_images=True):
    """
    Helper function to extract events from a single bulletin.
    Returns (website, pdf_link, events_list, church_names, family_of_parishes) tuple.
    """
    logger = logging.getLogger(__name__)
    
    church_names = [c.get('name', 'Unknown') for c in churches_for_bulletin]
    family_of_parishes = events.get_family_of_parishes(churches_for_bulletin)
    
    # Prepare simplified church context for LLM
    churches_context = events.prepare_churches_context(churches_for_bulletin)
    
    # Filter existing events to this family for deduplication context
    family_events = events.filter_events_for_family(existing_events, family_of_parishes)
    events_context = events.prepare_existing_events_context(family_events)
    
    # Extract events from bulletin
    extracted = llm.extract_events_from_bulletin(
        pdf_path, 
        churches_context, 
        events_context, 
        model=model,
        use_images=use_images
    )
    
    if extracted is None:
        logger.warning(f"Failed to extract events for churches: {', '.join(church_names)}")
        return (website, pdf_link, [], church_names, family_of_parishes)
    
    # Add metadata to each event
    for event in extracted:
        events.add_event_metadata(event, pdf_link)
    
    return (website, pdf_link, extracted, church_names, family_of_parishes)


def extract_intentions_task(website, pdf_link, pdf_path, churches_for_bulletin, model=None, use_images=True):
    """
    Helper function to extract Mass intentions from a single bulletin.
    Returns (website, pdf_link, intentions_list, church_names) tuple.
    """
    logger = logging.getLogger(__name__)
    
    church_names = [c.get('name', 'Unknown') for c in churches_for_bulletin]
    
    # Prepare churches context for LLM (includes mass schedules for matching)
    churches_context = intentions.prepare_churches_context(churches_for_bulletin)
    
    # Extract intentions from bulletin
    extracted = llm.extract_intentions_from_bulletin(
        pdf_path, 
        churches_context, 
        model=model,
        use_images=use_images
    )
    
    if extracted is None:
        logger.warning(f"Failed to extract intentions for churches: {', '.join(church_names)}")
        return (website, pdf_link, [], church_names)
    
    # Add metadata to each intention entry
    for intention in extracted:
        intentions.add_intention_metadata(intention, pdf_link)
    
    return (website, pdf_link, extracted, church_names)


def main():
    """Main application flow"""
    parser = argparse.ArgumentParser(
        description='Analyze church bulletins and suggest data updates'
    )
    parser.add_argument(
        '--mode',
        default='mass',
        choices=['mass', 'events', 'intentions'],
        help='Scraper mode: mass (update times), events (extract events), intentions (extract Mass intentions)'
    )
    parser.add_argument(
        '--log-level',
        default='INFO',
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
        help='Logging level (default: INFO)'
    )
    parser.add_argument(
        '--output',
        default=None,
        help='Output markdown file (default: bulletins_analysis.md for mass, events_analysis.md for events)'
    )
    parser.add_argument(
        '--database-path',
        default='../public/massfinder.db',
        help='Path to the SQLite database (default: ../public/massfinder.db)'
    )
    parser.add_argument(
        '--workers',
        type=int,
        default=10,
        help='Number of parallel workers for LLM analysis (default: 10)'
    )
    parser.add_argument(
        '--bulletins-per-site',
        type=int,
        default=1,
        help='Number of newest bulletin PDFs to download per bulletin site (default: 1)'
    )
    parser.add_argument(
        '--download-only',
        action='store_true',
        help='Scrape and download bulletin PDFs, then exit without LLM analysis or database changes'
    )
    parser.add_argument(
        '--model',
        default=None,
        help='LLM model to use (overrides default in llm.py)'
    )
    parser.add_argument(
        '--modify-db', '--modify-json',
        dest='modify_db',
        action='store_true',
        help='Apply LLM suggestions to update the SQLite database (the --modify-json alias is retained for workflow compatibility)'
    )
    parser.add_argument(
        '--no-images',
        action='store_true',
        help='Disable image-based analysis and use PDF mode instead (less accurate but faster)'
    )
    
    args = parser.parse_args()
    
    # Setup logging
    log_level = getattr(logging, args.log_level)
    logger = setup_logging(log_level)
    
    use_images = not args.no_images
    mode_str = "image" if use_images else "PDF"
    logger.info(f"Starting bulletin analysis in '{args.mode}' mode using {mode_str} analysis (log level: {args.log_level})")
    
    # Set model if provided
    if args.model:
        logger.info(f"Using custom model: {args.model}")
    
    # Resolve paths
    script_dir = Path(__file__).parent
    database_path = script_dir / args.database_path
    bulletins_dir = script_dir / 'bulletins'
    
    # Set default output path based on mode
    if args.output:
        output_path = script_dir / args.output
    else:
        default_outputs = {
            'mass': 'bulletins_analysis.md',
            'events': 'events_analysis.md',
            'intentions': 'intentions_analysis.md',
        }
        output_path = script_dir / default_outputs[args.mode]
    
    # Step 1: Open the SQLite database and load churches data
    try:
        database = open_database(database_path)
        churches = load_churches(database)
        logger.info(f"Loaded {len(churches)} churches")
    except Exception as e:
        logger.error(f"Failed to open/load SQLite database: {e}")
        return 1
    
    # Step 2: Scrape bulletin links with caching
    try:
        website_cache = scraping.get_bulletin_links(churches, limit=args.bulletins_per_site)
    except Exception as e:
        logger.error(f"Failed to scrape bulletin links: {e}")
        database.close()
        return 1
    
    # Step 3: Download bulletins
    try:
        downloaded = scraping.download_all_pdfs(website_cache, str(bulletins_dir))
        logger.info(f"Downloaded {len(downloaded)} bulletins")
    except Exception as e:
        logger.error(f"Failed to download bulletins: {e}")
        database.close()
        return 1
    
    if not downloaded:
        logger.warning("No bulletins downloaded. Exiting.")
        database.close()
        return 0

    if args.download_only:
        logger.info("Download-only mode complete; no PDF extraction or database updates were run.")
        database.close()
        return 0
    
    # Branch based on mode
    if args.mode == 'events':
        result = run_events_mode(args, logger, database, churches, downloaded, output_path, use_images)
    elif args.mode == 'intentions':
        result = run_intentions_mode(args, logger, database, churches, downloaded, output_path, use_images)
    else:
        result = run_mass_mode(args, logger, database, churches, downloaded, output_path, use_images)

    database.close()
    return result


def run_mass_mode(args, logger, database, churches, downloaded, output_path, use_images=True):
    """Run the mass times analysis mode (original behavior)."""
    
    # Analyze each bulletin with LLM in parallel
    logger.info(f"Analyzing {len(downloaded)} bulletin(s) with LLM (using {args.workers} workers)...")
    markdown_results_unordered = {}  # Temporary dict to collect results from parallel execution
    
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
            executor.submit(
                analyze_bulletin_task, 
                website, pdf_link, pdf_path, churches_for_bulletin, 
                model=args.model, use_images=use_images
            ): (website, pdf_link, churches_for_bulletin)
            for website, pdf_link, pdf_path, churches_for_bulletin in tasks
        }
        
        # Process results as they complete
        for future in as_completed(futures):
            try:
                website, pdf_link, markdown, church_names, churches_for_bulletin = future.result()
                
                if markdown:  # Only add if there are differences
                    markdown_results_unordered[website] = {
                        'markdown': markdown,
                        'church_names': church_names,
                        'churches': churches_for_bulletin,
                        'pdf_link': pdf_link
                    }
            except Exception as e:
                logger.error(f"Task failed: {e}")
                continue
    
    # Reorder results to match the order of churches in SQLite using a list of tuples
    markdown_results = []
    seen_websites = set()
    for church in churches:
        bulletin_website = church.get('bulletin_website', '')
        if bulletin_website in markdown_results_unordered and bulletin_website not in seen_websites:
            markdown_results.append((bulletin_website, markdown_results_unordered[bulletin_website]))
            seen_websites.add(bulletin_website)
    
    # Write results to markdown file
    try:
        write_analysis_report(output_path, markdown_results)
        logger.info(f"Analysis complete. Results saved to {output_path}")
    except Exception as e:
        logger.error(f"Failed to write analysis report: {e}")
        return 1
    
    # Optionally apply modifications to SQLite
    if args.modify_db:
        logger.info("Database modification enabled. Applying LLM suggestions to SQLite...")
        try:
            # Read the generated markdown report
            with open(output_path, 'r', encoding='utf-8') as f:
                markdown_content = f.read()
            
            # Apply modifications
            updated_churches = llm.update_churches_from_markdown(
                churches,
                markdown_content,
                markdown_results,
                model=args.model
            )
            
            replace_churches(database, updated_churches)
            
            logger.info("✓ SQLite church data updated successfully")
        except Exception as e:
            logger.error(f"Failed to modify SQLite church data: {e}")
            return 1
    
    # Summary
    if markdown_results:
        logger.info(f"Found {len(markdown_results)} bulletin(s) with differences")
    else:
        logger.info("No differences found across all bulletins ✓")
    
    return 0


def run_events_mode(args, logger, database, churches, downloaded, output_path, use_images=True):
    """Run the events extraction mode."""
    
    # Load existing events for deduplication
    existing_events = load_events(database)
    
    # Extract events from each bulletin in parallel
    logger.info(f"Extracting events from {len(downloaded)} bulletin(s) with LLM (using {args.workers} workers)...")
    all_extracted_events = []
    events_results = []  # For report generation
    
    # Prepare extraction tasks
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
    
    # Execute extraction tasks in parallel
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        # Submit all tasks
        futures = {
            executor.submit(
                extract_events_task, 
                website, pdf_link, pdf_path, churches_for_bulletin, 
                existing_events, model=args.model, use_images=use_images
            ): (website, pdf_link, churches_for_bulletin)
            for website, pdf_link, pdf_path, churches_for_bulletin in tasks
        }
        
        # Process results as they complete
        for future in as_completed(futures):
            try:
                website, pdf_link, extracted_events, church_names, family_of_parishes = future.result()
                
                if extracted_events:
                    all_extracted_events.extend(extracted_events)
                    events_results.append({
                        'website': website,
                        'pdf_link': pdf_link,
                        'events': extracted_events,
                        'church_names': church_names,
                        'family_of_parishes': family_of_parishes
                    })
            except Exception as e:
                logger.error(f"Events extraction task failed: {e}")
                continue
    
    # Merge extracted events with existing events
    merged_events = events.merge_events(existing_events, all_extracted_events)
    
    # Write events analysis report
    try:
        write_events_report(output_path, events_results)
        logger.info(f"Events extraction complete. Report saved to {output_path}")
    except Exception as e:
        logger.error(f"Failed to write events report: {e}")
        return 1
    
    # Optionally save merged events to SQLite
    if args.modify_db:
        logger.info("Database modification enabled. Saving events to SQLite...")
        try:
            replace_events(database, merged_events)
            logger.info("✓ SQLite event data updated successfully")
        except Exception as e:
            logger.error(f"Failed to save events to SQLite: {e}")
            return 1
    
    # Summary
    logger.info(f"Extracted {len(all_extracted_events)} events from {len(events_results)} bulletin(s)")
    logger.info(f"Total events after merge: {len(merged_events)}")
    
    return 0


def run_intentions_mode(args, logger, database, churches, downloaded, output_path, use_images=True):
    """Run the Mass intentions extraction mode."""
    
    # Load existing intentions for merging
    existing_intentions = load_intentions(database)
    
    # Extract intentions from each bulletin in parallel
    logger.info(f"Extracting Mass intentions from {len(downloaded)} bulletin(s) with LLM (using {args.workers} workers)...")
    all_extracted_intentions = []
    intentions_results = []  # For report generation
    
    # Prepare extraction tasks
    tasks = []
    # Diagnostic: log downloaded websites and how many churches match each
    logger.debug(f"Downloaded bulletin websites: {[w for w, _, _ in downloaded][:10]}")
    for website, pdf_link, pdf_path in downloaded:
        churches_for_bulletin = [
            c for c in churches 
            if c.get('bulletin_website') == website
        ]
        logger.debug(f"Website {website} -> matched {len(churches_for_bulletin)} church(es)")
        
        if not churches_for_bulletin:
            logger.warning(f"No church found for website {website}, skipping")
            continue
        
        tasks.append((website, pdf_link, pdf_path, churches_for_bulletin))
    
    # Execute extraction tasks in parallel
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(
                extract_intentions_task, 
                website, pdf_link, pdf_path, churches_for_bulletin, 
                model=args.model, use_images=use_images
            ): (website, pdf_link, churches_for_bulletin)
            for website, pdf_link, pdf_path, churches_for_bulletin in tasks
        }
        
        for future in as_completed(futures):
            try:
                website, pdf_link, extracted_intentions, church_names = future.result()
                
                if extracted_intentions:
                    all_extracted_intentions.extend(extracted_intentions)
                    intentions_results.append({
                        'website': website,
                        'pdf_link': pdf_link,
                        'intentions': extracted_intentions,
                        'church_names': church_names,
                    })
            except Exception as e:
                logger.error(f"Intentions extraction task failed: {e}")
                continue
    
    # Merge extracted intentions with existing
    merged_intentions = intentions.merge_intentions(existing_intentions, all_extracted_intentions)
    
    # Write intentions analysis report
    try:
        write_intentions_report(output_path, intentions_results)
        logger.info(f"Intentions extraction complete. Report saved to {output_path}")
    except Exception as e:
        logger.error(f"Failed to write intentions report: {e}")
        return 1
    
    # Optionally save merged intentions to SQLite
    if args.modify_db:
        logger.info("Database modification enabled. Saving intentions to SQLite...")
        try:
            replace_intentions(database, merged_intentions)
            logger.info("✓ SQLite intention data updated successfully")
        except Exception as e:
            logger.error(f"Failed to save intentions to SQLite: {e}")
            return 1
    
    # Summary
    total_masses = len(all_extracted_intentions)
    total_intentions = sum(len(m.get('intentions', [])) for m in all_extracted_intentions)
    logger.info(f"Extracted {total_intentions} intentions across {total_masses} Masses from {len(intentions_results)} bulletin(s)")
    logger.info(f"Total intention entries after merge: {len(merged_intentions)}")
    
    return 0


def write_intentions_report(output_path, intentions_results):
    """Write intentions extraction report to markdown file."""
    logger = logging.getLogger(__name__)
    logger.info(f"Writing intentions report to {output_path}")
    
    total_masses = sum(len(r['intentions']) for r in intentions_results)
    total_intentions = sum(
        sum(len(m.get('intentions', [])) for m in r['intentions'])
        for r in intentions_results
    )
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("# Mass Intentions Extraction Report\n\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        f.write("## Summary\n\n")
        if not intentions_results:
            f.write("No Mass intentions found in any bulletins.\n\n")
        else:
            f.write(f"Extracted **{total_intentions}** intentions across **{total_masses}** Masses from **{len(intentions_results)}** bulletin(s).\n\n")
        
        if intentions_results:
            f.write("## Extracted Intentions\n\n")
            
            for result in intentions_results:
                pdf_link = result.get('pdf_link', result.get('website', ''))
                church_names = result.get('church_names', [])
                intentions_list = result.get('intentions', [])
                
                encoded_link = quote(pdf_link, safe=':/?#[]@!\'()*+,;=')
                
                f.write(f"### [Bulletin]({encoded_link})\n\n")
                f.write(f"**Churches:** {', '.join(church_names)}\n\n")
                
                if not intentions_list:
                    f.write("*No intentions found.*\n\n")
                else:
                    f.write("| Date | Time | Church | Intention For | Requested By |\n")
                    f.write("|------|------|--------|---------------|-------------|\n")
                    
                    for mass in intentions_list:
                        date = mass.get('date', 'N/A')
                        time_val = mass.get('time', 'N/A')
                        church_id = mass.get('church_id', 'N/A')
                        
                        for intention in mass.get('intentions', []):
                            for_val = intention.get('for', 'N/A')
                            by_val = intention.get('by') or 'N/A'
                            f.write(f"| {date} | {time_val} | {church_id} | {for_val} | {by_val} |\n")
                    
                    f.write("\n")
        
        f.write("*End of report.*\n")


def write_analysis_report(output_path, markdown_results):
    """Write markdown results to file, grouped by bulletin website in order"""
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
            
            # Write results in order (list of tuples preserves order)
            for website, result in markdown_results:
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


def write_events_report(output_path, events_results):
    """Write events extraction report to markdown file"""
    logger = logging.getLogger(__name__)
    logger.info(f"Writing events report to {output_path}")
    
    total_events = sum(len(r['events']) for r in events_results)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        # Write header
        f.write("# Events Extraction Report\n\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        # Write summary
        f.write("## Summary\n\n")
        if not events_results:
            f.write("No events found in any bulletins.\n\n")
        else:
            f.write(f"Extracted **{total_events}** events from **{len(events_results)}** bulletin(s).\n\n")
        
        # Write events by bulletin
        if events_results:
            f.write("## Extracted Events\n\n")
            
            for result in events_results:
                pdf_link = result.get('pdf_link', result.get('website', ''))
                church_names = result.get('church_names', [])
                family = result.get('family_of_parishes', 'Unknown')
                events_list = result.get('events', [])
                
                # URL-encode the link
                encoded_link = quote(pdf_link, safe=':/?#[]@!$&\'()*+,;=')
                
                # Write bulletin header
                f.write(f"### [Bulletin]({encoded_link})\n\n")
                f.write(f"**Churches:** {', '.join(church_names)}\n\n")
                f.write(f"**Family of Parishes:** {family}\n\n")
                
                if not events_list:
                    f.write("*No events found.*\n\n")
                else:
                    # Write events table
                    f.write("| Date | Title | Time | Location | Tags |\n")
                    f.write("|------|-------|------|----------|------|\n")
                    
                    for event in events_list:
                        date = event.get('date', 'N/A')
                        title = event.get('title', 'N/A')
                        start = event.get('start_time', '')
                        end = event.get('end_time', '')
                        time_str = f"{start}-{end}" if start and end else (start or end or 'N/A')
                        location = event.get('location', 'N/A') or 'N/A'
                        tags = ', '.join(event.get('tags', [])) or 'N/A'
                        
                        f.write(f"| {date} | {title} | {time_str} | {location} | {tags} |\n")
                    
                    f.write("\n")
        
        # Write footer
        f.write("*End of report.*\n")


if __name__ == '__main__':
    sys.exit(main())
