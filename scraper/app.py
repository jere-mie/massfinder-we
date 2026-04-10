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
import json
import argparse
from pathlib import Path
from datetime import datetime
from urllib.parse import quote, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

# Import utilities
from utils import scraping, llm, events, intentions
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


# Historic / custom command implementations live in custom_commands.py
from custom_commands import (
    HISTORIC_INTENTIONS_MODEL,
    HISTORIC_VERIFY_MAX_ATTEMPTS,
    extract_and_verify_intentions_task,
    run_historic_intentions_mode,
    run_historic_ahcfop_mode,
    write_intentions_report,
)


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
        '--churches-path',
        default='../public/churches.json',
        help='Path to churches.json (default: ../public/churches.json)'
    )
    parser.add_argument(
        '--events-path',
        default='../public/events.json',
        help='Path to events.json (default: ../public/events.json)'
    )
    parser.add_argument(
        '--intentions-path',
        default='../public/intentions.json',
        help='Path to intentions.json (default: ../public/intentions.json)'
    )
    parser.add_argument(
        '--workers',
        type=int,
        default=10,
        help='Number of parallel workers for LLM analysis (default: 10)'
    )
    parser.add_argument(
        '--model',
        default=None,
        help='LLM model to use (overrides default in llm.py)'
    )
    parser.add_argument(
        '--modify-json',
        action='store_true',
        help='Apply LLM suggestions to update churches.json or events.json'
    )
    parser.add_argument(
        '--no-images',
        action='store_true',
        help='Disable image-based analysis and use PDF mode instead (less accurate but faster)'
    )
    parser.add_argument(
        '--historic',
        action='store_true',
        help='Scan ALL prior bulletins for each family of parishes (intentions mode only). '
             f'Automatically uses the free model "{HISTORIC_INTENTIONS_MODEL}" unless --model is specified.'
    )
    parser.add_argument(
        '--historic-ahcfop',
        action='store_true',
        dest='historic_ahcfop',
        help='Extract intentions from pre-downloaded AHCFOP bulletins using page-batch mode '
             '(intentions mode only). '
             f'Automatically uses the free model "{HISTORIC_INTENTIONS_MODEL}" unless --model is specified.'
    )

    args = parser.parse_args()
    
    # Setup logging
    log_level = getattr(logging, args.log_level)
    logger = setup_logging(log_level)
    
    use_images = not args.no_images
    mode_str = "image" if use_images else "PDF"
    logger.info(f"Starting bulletin analysis in '{args.mode}' mode using {mode_str} analysis (log level: {args.log_level})")

    # Validate historic flags are only valid with --mode intentions
    if args.historic and args.mode != 'intentions':
        logger.error("--historic can only be used with --mode intentions")
        return 1
    if args.historic_ahcfop and args.mode != 'intentions':
        logger.error("--historic-ahcfop can only be used with --mode intentions")
        return 1

    # Set model if provided
    if args.model:
        logger.info(f"Using custom model: {args.model}")
    
    # Resolve paths
    script_dir = Path(__file__).parent
    churches_path = script_dir / args.churches_path
    events_path = script_dir / args.events_path
    intentions_path = script_dir / args.intentions_path
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
    
    # Historic intentions mode: fetch ALL prior bulletins, one family at a time
    if args.historic:
        historic_model = args.model if args.model else HISTORIC_INTENTIONS_MODEL
        logger.info(f"Historic mode: will process ALL prior bulletins using model '{historic_model}'")
        return run_historic_intentions_mode(
            args, logger, churches, intentions_path, output_path, use_images, historic_model
        )

    # Historic AHCFOP batch mode: extract from pre-downloaded bulletins using page-batch LLM calls
    if args.historic_ahcfop:
        ahcfop_model = args.model if args.model else HISTORIC_INTENTIONS_MODEL
        logger.info(f"Historic AHCFOP mode: batch-extracting intentions using model '{ahcfop_model}'")
        return run_historic_ahcfop_mode(
            args, logger, churches, intentions_path, output_path, ahcfop_model
        )

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
    
    # Branch based on mode
    if args.mode == 'events':
        return run_events_mode(args, logger, churches, downloaded, events_path, output_path, use_images)
    elif args.mode == 'intentions':
        return run_intentions_mode(args, logger, churches, downloaded, intentions_path, output_path, use_images)
    else:
        return run_mass_mode(args, logger, churches, downloaded, churches_path, output_path, use_images)


def run_mass_mode(args, logger, churches, downloaded, churches_path, output_path, use_images=True):
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
    
    # Reorder results to match the order of churches in churches.json using a list of tuples
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
    
    # Optionally apply modifications to churches.json
    if args.modify_json:
        logger.info("--modify-json flag set. Applying LLM suggestions to churches.json...")
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
            
            # Write updated churches.json
            with open(churches_path, 'w', encoding='utf-8') as f:
                json.dump(updated_churches, f, indent=4, ensure_ascii=False)
            
            logger.info(f"✓ churches.json updated successfully: {churches_path}")
        except Exception as e:
            logger.error(f"Failed to modify churches.json: {e}")
            return 1
    
    # Summary
    if markdown_results:
        logger.info(f"Found {len(markdown_results)} bulletin(s) with differences")
    else:
        logger.info("No differences found across all bulletins ✓")
    
    return 0


def run_events_mode(args, logger, churches, downloaded, events_path, output_path, use_images=True):
    """Run the events extraction mode."""
    
    # Load existing events for deduplication
    existing_events = events.load_events_json(str(events_path))
    
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
    
    # Optionally save merged events to events.json
    if args.modify_json:
        logger.info("--modify-json flag set. Saving events to events.json...")
        try:
            events.save_events_json(merged_events, str(events_path))
            logger.info(f"✓ events.json updated successfully: {events_path}")
        except Exception as e:
            logger.error(f"Failed to save events.json: {e}")
            return 1
    
    # Summary
    logger.info(f"Extracted {len(all_extracted_events)} events from {len(events_results)} bulletin(s)")
    logger.info(f"Total events after merge: {len(merged_events)}")
    
    return 0


def run_intentions_mode(args, logger, churches, downloaded, intentions_path, output_path, use_images=True):
    """Run the Mass intentions extraction mode."""
    
    # Load existing intentions for merging
    existing_intentions = intentions.load_intentions_json(str(intentions_path))
    
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
    
    # Optionally save merged intentions to intentions.json
    if args.modify_json:
        logger.info("--modify-json flag set. Saving intentions to intentions.json...")
        try:
            intentions.save_intentions_json(merged_intentions, str(intentions_path))
            logger.info(f"✓ intentions.json updated successfully: {intentions_path}")
        except Exception as e:
            logger.error(f"Failed to save intentions.json: {e}")
            return 1
    
    # Summary
    total_masses = len(all_extracted_intentions)
    total_intentions = sum(len(m.get('intentions', [])) for m in all_extracted_intentions)
    logger.info(f"Extracted {total_intentions} intentions across {total_masses} Masses from {len(intentions_results)} bulletin(s)")
    logger.info(f"Total intention entries after merge: {len(merged_intentions)}")

    return 0


def run_historic_intentions_mode(args, logger, churches, intentions_path, output_path, use_images, model):
    """
    Run the historic Mass intentions extraction mode.

    Fetches ALL available bulletin PDFs for each family of parishes and processes
    them sequentially, one family at a time. By default uses the free
    'openrouter/healer-alpha' model unless overridden with --model.
    """
    script_dir = Path(__file__).parent
    historic_dir = script_dir / 'bulletins' / 'historic'

    # Step 1: Fetch all bulletin links for every website
    logger.info("Fetching all historic bulletin links for all families of parishes...")
    try:
        all_bulletin_links = scraping.get_all_bulletin_links(churches)
    except Exception as e:
        logger.error(f"Failed to scrape historic bulletin links: {e}")
        return 1

    # Build ordered mapping of bulletin_website -> churches (preserves churches.json order)
    website_to_churches = {}
    for church in churches:
        website = church.get('bulletin_website', '')
        if not website or website == 'N/A':
            continue
        if website not in website_to_churches:
            website_to_churches[website] = []
        website_to_churches[website].append(church)

    total_families = len(website_to_churches)
    if total_families == 0:
        logger.warning("No families with bulletin websites found. Exiting.")
        return 0

    logger.info(f"Found {total_families} families of parishes to process")
    logger.info(f"Using model: {model}")

    # Load existing intentions once up front
    existing_intentions = intentions.load_intentions_json(str(intentions_path))
    all_extracted_intentions = []
    all_intentions_results = []

    # Process each family of parishes one at a time (sequentially)
    for family_idx, (website, churches_for_family) in enumerate(website_to_churches.items(), 1):
        family_name = events.get_family_of_parishes(churches_for_family) or website
        church_names_list = [c.get('name', 'Unknown') for c in churches_for_family]

        logger.info(f"\n--- [{family_idx}/{total_families}] Family: {family_name} ---")
        logger.info(f"Churches: {', '.join(church_names_list)}")

        pdf_links = all_bulletin_links.get(website, [])
        if not pdf_links:
            logger.warning("No bulletins found for this family, skipping")
            continue

        logger.info(f"Found {len(pdf_links)} bulletin(s) to process")

        # Create a unique subdirectory for this family's downloaded PDFs
        domain = urlparse(website).netloc.replace('.', '_').replace('-', '_')
        family_dir = historic_dir / f"{family_idx:02d}_{domain}"

        # Download all PDFs for this family
        logger.info(f"Downloading {len(pdf_links)} bulletin(s) to {family_dir}...")
        try:
            downloaded = scraping.download_pdfs_for_website(pdf_links, str(family_dir))
        except Exception as e:
            logger.error(f"Failed to download bulletins for {family_name}: {e}")
            continue

        if not downloaded:
            logger.warning("No bulletins downloaded for this family, skipping")
            continue

        logger.info(f"Successfully downloaded {len(downloaded)} of {len(pdf_links)} bulletin(s)")

        # Extract + verify intentions from all bulletins for this family (parallel within family)
        logger.info(
            f"Extracting & verifying intentions "
            f"(up to {HISTORIC_VERIFY_MAX_ATTEMPTS} LLM passes per bulletin, "
            f"{args.workers} workers)..."
        )
        family_extracted = []
        family_results = []

        with ThreadPoolExecutor(max_workers=args.workers) as executor:
            futures = {
                executor.submit(
                    extract_and_verify_intentions_task,
                    website, pdf_link, pdf_path, churches_for_family,
                    model=model, use_images=use_images
                ): (pdf_link, pdf_path)
                for pdf_link, pdf_path in downloaded
            }

            for future in as_completed(futures):
                try:
                    _, bulletin_pdf_link, extracted_list, bulletin_church_names = future.result()
                    if extracted_list:
                        family_extracted.extend(extracted_list)
                        family_results.append({
                            'website': website,
                            'pdf_link': bulletin_pdf_link,
                            'intentions': extracted_list,
                            'church_names': bulletin_church_names,
                        })
                except Exception as e:
                    logger.error(f"Extraction task failed: {e}")
                    continue

        masses_count = len(family_extracted)
        intentions_count = sum(len(m.get('intentions', [])) for m in family_extracted)
        logger.info(f"Extracted {intentions_count} intentions across {masses_count} Masses for this family")

        all_extracted_intentions.extend(family_extracted)
        all_intentions_results.extend(family_results)

    # Merge all extracted intentions with the existing data
    merged_intentions = intentions.merge_intentions(existing_intentions, all_extracted_intentions)

    # Write consolidated intentions report
    try:
        write_intentions_report(output_path, all_intentions_results)
        logger.info(f"Historic intentions extraction complete. Report saved to {output_path}")
    except Exception as e:
        logger.error(f"Failed to write intentions report: {e}")
        return 1

    # Optionally persist merged intentions to intentions.json
    if args.modify_json:
        logger.info("--modify-json flag set. Saving intentions to intentions.json...")
        try:
            intentions.save_intentions_json(merged_intentions, str(intentions_path))
            logger.info(f"✓ intentions.json updated successfully: {intentions_path}")
        except Exception as e:
            logger.error(f"Failed to save intentions.json: {e}")
            return 1

    # Final summary
    total_masses = len(all_extracted_intentions)
    total_count = sum(len(m.get('intentions', [])) for m in all_extracted_intentions)
    logger.info(
        f"\nHistoric extraction complete: {total_count} intentions across {total_masses} Masses "
        f"from {len(all_intentions_results)} bulletin(s) across {total_families} families"
    )
    logger.info(f"Total intention entries after merge: {len(merged_intentions)}")

    return 0


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