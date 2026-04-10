#!/usr/bin/env python3
"""
Custom commands for specialized bulletin analysis tasks.

Handles:
  --historic          Scan ALL prior bulletins for every family of parishes
                      (extract + verify intentions, one family at a time).
  --historic-ahcfop   Extract intentions from pre-downloaded AHCFOP bulletins
                      in batches of AHCFOP_BATCH_SIZE. Intentions are always on
                      page AHCFOP_INTENTIONS_PAGE of those bulletins.

Can be run standalone:
  python custom_commands.py --historic          [options]
  python custom_commands.py --historic-ahcfop   [options]

Or imported by app.py for use within the main pipeline:
  from custom_commands import (
      HISTORIC_INTENTIONS_MODEL,
      HISTORIC_VERIFY_MAX_ATTEMPTS,
      extract_and_verify_intentions_task,
      run_historic_intentions_mode,
      run_historic_ahcfop_mode,
      write_intentions_report,
  )
"""

import logging
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime
from urllib.parse import quote, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

from utils import scraping, llm, events, intentions
from utils.logging_config import setup_logging
from utils.pdf_to_images import convert_pdf_to_images
import os
import requests

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Free model used automatically for historic modes unless --model is specified
HISTORIC_INTENTIONS_MODEL = 'openrouter/healer-alpha'

# Local Ollama model for AHCFOP batch mode (change to your installed model)
# Common options: mistral, neural-chat, llama2, dolphin-mixtral, etc.
OLLAMA_DEFAULT_MODEL = 'qwen3.5:latest'

# Maximum total LLM calls per bulletin / batch:  1 extraction + (N-1) verification passes
HISTORIC_VERIFY_MAX_ATTEMPTS = 5

# AHCFOP-specific settings
AHCFOP_FOLDER_NAME = '01_www_ahcfop_ca'       # Subfolder under bulletins/historic/
AHCFOP_INTENTIONS_PAGE = 2                    # 1-indexed page number where intentions live
AHCFOP_BATCH_SIZE = 10                        # Number of bulletins per single LLM request


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def write_intentions_report(output_path, intentions_results):
    """Write a Mass intentions extraction report to a Markdown file."""
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
            f.write(
                f"Extracted **{total_intentions}** intentions across "
                f"**{total_masses}** Masses from **{len(intentions_results)}** bulletin(s).\n\n"
            )

        if intentions_results:
            f.write("## Extracted Intentions\n\n")

            for result in intentions_results:
                pdf_link = result.get('pdf_link', result.get('website', ''))
                church_names = result.get('church_names', [])
                intentions_list = result.get('intentions', [])

                encoded_link = quote(str(pdf_link), safe=':/?#[]@!\'()*+,;=')

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
                            f.write(
                                f"| {date} | {time_val} | {church_id} "
                                f"| {for_val} | {by_val} |\n"
                            )

                    f.write("\n")

    # end of write_intentions_report


# ---------------------------------------------------------------------------
# Historic mode (all families of parishes)
# ---------------------------------------------------------------------------

def extract_and_verify_intentions_task(
    website, pdf_link, pdf_path, churches_for_bulletin, model=None, use_images=True
):
    """
    Extract Mass intentions from a bulletin then run a self-correction verification
    loop (used in historic mode only).

    Performs one initial extraction followed by up to (HISTORIC_VERIFY_MAX_ATTEMPTS - 1)
    verification passes. Stops early when the model confirms the data is correct, or
    after HISTORIC_VERIFY_MAX_ATTEMPTS total LLM calls.

    Returns the same (website, pdf_link, intentions_list, church_names) tuple as
    extract_intentions_task so it is a drop-in replacement.
    """
    logger = logging.getLogger(__name__)
    church_names = [c.get('name', 'Unknown') for c in churches_for_bulletin]
    churches_context = intentions.prepare_churches_context(churches_for_bulletin)

    # --- Attempt 1: initial extraction ---
    logger.info(
        f"Extracting intentions (attempt 1/{HISTORIC_VERIFY_MAX_ATTEMPTS}) "
        f"for: {', '.join(church_names)}"
    )
    extracted_list = llm.extract_intentions_from_bulletin(
        pdf_path, churches_context, model=model, use_images=use_images
    )

    if extracted_list is None:
        logger.warning(f"Initial extraction failed for: {', '.join(church_names)}")
        return (website, pdf_link, [], church_names)

    if not extracted_list:
        logger.info(f"No intentions found for: {', '.join(church_names)}, skipping verification")
        return (website, pdf_link, extracted_list, church_names)

    # --- Attempts 2 … HISTORIC_VERIFY_MAX_ATTEMPTS: verification / correction loop ---
    for attempt in range(2, HISTORIC_VERIFY_MAX_ATTEMPTS + 1):
        verify_pass = attempt - 1
        logger.info(
            f"Verification pass {verify_pass}/{HISTORIC_VERIFY_MAX_ATTEMPTS - 1} "
            f"for: {', '.join(church_names)}"
        )
        try:
            is_verified, corrected = llm.verify_intentions_from_bulletin(
                pdf_path, churches_context, extracted_list, model=model, use_images=use_images
            )
        except Exception as e:
            logger.error(
                f"Verification pass {verify_pass} raised an exception for "
                f"{', '.join(church_names)}: {e}. Proceeding with current result."
            )
            break

        extracted_list = corrected

        if is_verified:
            logger.info(
                f"✓ Intentions confirmed correct after {verify_pass} verification pass(es) "
                f"for: {', '.join(church_names)}"
            )
            break

        if attempt < HISTORIC_VERIFY_MAX_ATTEMPTS:
            logger.info("Corrections applied, proceeding to next verification pass...")
        else:
            logger.warning(
                f"Reached max verification attempts ({HISTORIC_VERIFY_MAX_ATTEMPTS}) for: "
                f"{', '.join(church_names)}. Proceeding with best available result."
            )

    # Add metadata to every final intention entry
    for intention in extracted_list:
        intentions.add_intention_metadata(intention, pdf_link)

    return (website, pdf_link, extracted_list, church_names)


def run_historic_intentions_mode(
    args, logger, churches, intentions_path, output_path, use_images, model
):
    """
    Run the historic Mass intentions extraction mode.

    Fetches ALL available bulletin PDFs for each family of parishes and processes
    them sequentially, one family at a time.  By default uses the free
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

    # Build ordered mapping of bulletin_website -> churches
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

        # Extract + verify intentions in parallel within this family
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
                    model=model, use_images=use_images,
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
        logger.info(
            f"Extracted {intentions_count} intentions across {masses_count} Masses for this family"
        )

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

    # Optionally persist merged intentions
    if args.modify_json:
        logger.info("--modify-json flag set. Saving intentions to intentions.json...")
        try:
            intentions.save_intentions_json(merged_intentions, str(intentions_path))
            logger.info(f"✓ intentions.json updated successfully: {intentions_path}")
        except Exception as e:
            logger.error(f"Failed to save intentions.json: {e}")
            return 1

    total_masses = len(all_extracted_intentions)
    total_count = sum(len(m.get('intentions', [])) for m in all_extracted_intentions)
    logger.info(
        f"\nHistoric extraction complete: {total_count} intentions across {total_masses} Masses "
        f"from {len(all_intentions_results)} bulletin(s) across {total_families} families"
    )
    logger.info(f"Total intention entries after merge: {len(merged_intentions)}")

    return 0


# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Ollama helpers (used for AHCFOP batch mode)
# ---------------------------------------------------------------------------

def _ollama_request(ollama_url, model, prompt_text, timeout, logger):
    """Send request to Ollama using the official ollama Python library."""
    import ollama
    
    try:
        # Extract base URL from full endpoint URL (remove /api/generate if present)
        base_url = ollama_url
        if base_url.endswith('/api/generate'):
            base_url = base_url[:-len('/api/generate')]
        if base_url.endswith('/api/chat'):
            base_url = base_url[:-len('/api/chat')]
        
        client = ollama.Client(host=base_url)
        
        # Check if model exists first
        try:
            models = client.list()
            available_models = [m.model for m in models.models] if models.models else []
            if model not in available_models:
                logger.error(
                    f"Model '{model}' not found on Ollama at {base_url}. "
                    f"Available models: {', '.join(available_models) if available_models else '(none installed)'}"
                )
                return None
        except Exception as e:
            logger.warning(f"Could not list Ollama models: {e}. Proceeding anyway...")
        
        response = client.generate(
            model=model,
            prompt=prompt_text,
            stream=False
        )
        return response
    except Exception as e:
        logger.error(f"Ollama request failed: {e} - base_url: {base_url}")
        return None


def _extract_batch_via_ollama(labeled_pages, churches_context, model, ollama_url, logger):
    """Extract intentions from bulletin pages using local Ollama."""

    import re
    import json
    from datetime import datetime

    current_date = datetime.now().strftime('%Y-%m-%d')

    # Build prompt with embedded base64 images
    prompt_lines = [
        f"You are extracting MASS INTENTIONS from {len(labeled_pages)} bulletin page(s).",
        "Each base64 image below is labeled with its source filename.",
        "Extract ALL mass intentions visible in the images.",
        "Return ONLY a valid JSON array. No explanation.",
        "",
        "CHURCHES:",
        json.dumps(churches_context, indent=2),
        "",
        f"DATE: {current_date}",
        "",
    ]

    for filename, img in labeled_pages:
        try:
            # Get base64 data URL and strip the "data:image/png;base64," prefix
            data_url = llm._encode_image_to_base64(img)
            base64_str = data_url.split(",")[1] if "," in data_url else data_url
            prompt_lines.append(f"[{filename}]")
            prompt_lines.append(base64_str[:100] + "...")  # Show truncated base64 for readability
        except Exception as e:
            logger.error(f"Failed to encode image {filename}: {e}")

    prompt_text = "\n".join(prompt_lines)

    result = _ollama_request(ollama_url, model, prompt_text, timeout=240, logger=logger)
    if result is None:
        return None

    # Parse response from Ollama
    try:
        response_text = result.get("response", "").strip()
    except Exception:
        logger.error("Ollama: unexpected response structure")
        logger.debug(f"Raw response: {result}")
        return None

    if not response_text:
        logger.warning("Ollama: empty response content")
        return None

    # Extract JSON array
    json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from Ollama response: {e}")
            logger.debug(f"Response excerpt: {response_text[:1000]}")
            return None

    if response_text == '[]':
        return []

    logger.warning("Ollama: could not find JSON array in response")
    logger.debug(f"Response excerpt: {response_text[:1000]}")
    return None


def _verify_batch_via_ollama(labeled_pages, churches_context, extracted_batch, model, ollama_url, logger):
    """Verify extracted intentions using local Ollama."""

    import re
    import json

    # Build prompt with embedded base64 images and previous extraction
    prompt_lines = [
        "You are verifying previously extracted Mass intentions against bulletin page images.",
        "If EVERYTHING is correct, respond ONLY with: VERIFIED",
        "Otherwise return the FULL corrected JSON array.",
        "Do not explain anything.",
        "",
        "CHURCHES:",
        json.dumps(churches_context, indent=2),
        "",
        "PREVIOUS_EXTRACTION:",
        json.dumps(extracted_batch, indent=2),
        "",
    ]

    for filename, img in labeled_pages:
        try:
            data_url = llm._encode_image_to_base64(img)
            base64_str = data_url.split(",")[1] if "," in data_url else data_url
            prompt_lines.append(f"[{filename}]")
            prompt_lines.append(base64_str[:100] + "...")  # Show truncated base64
        except Exception as e:
            logger.error(f"Failed to encode image {filename} for verification: {e}")

    prompt_text = "\n".join(prompt_lines)

    result = _ollama_request(ollama_url, model, prompt_text, timeout=240, logger=logger)
    if result is None:
        return False, extracted_batch

    # Parse response from Ollama
    try:
        response_text = result.get("response", "").strip()
    except Exception:
        logger.error("Ollama: unexpected verification response structure")
        logger.debug(f"Raw response: {result}")
        return False, extracted_batch

    if not response_text:
        logger.warning("Ollama: empty verification response")
        return False, extracted_batch

    if response_text == "VERIFIED":
        return True, extracted_batch

    # Try to parse corrected JSON
    json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
    if json_match:
        try:
            corrected = json.loads(json_match.group(0))
            return False, corrected
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from verification response: {e}")
            logger.debug(f"Response excerpt: {response_text[:1000]}")
            return False, extracted_batch

    if response_text == '[]':
        return False, []

    logger.warning("Ollama: could not parse verification response")
    logger.debug(f"Response excerpt: {response_text[:1000]}")
    return False, extracted_batch

# ---------------------------------------------------------------------------
# AHCFOP batch mode
# ---------------------------------------------------------------------------

def _get_pdf_page_image(pdf_path, page_num=2):
    """
    Extract a single page (1-indexed) from a PDF and return it as a PIL Image.
    Returns None if the PDF has fewer pages than requested or conversion fails.
    """
    _logger = logging.getLogger(__name__)
    images = convert_pdf_to_images(str(pdf_path), max_pages=page_num)
    if len(images) >= page_num:
        return images[page_num - 1]
    _logger.warning(
        f"PDF {Path(pdf_path).name} has only {len(images)} page(s), "
        f"cannot extract page {page_num}"
    )
    return None


def run_historic_ahcfop_mode(args, logger, churches, intentions_path, output_path, model):
    """
    Extract intentions for the Amherstburg-Harrow Catholic Family of Parishes from
    pre-downloaded historic bulletins stored in
    bulletins/historic/AHCFOP_FOLDER_NAME/.

    Intentions are always on page AHCFOP_INTENTIONS_PAGE of every bulletin.
    Bulletins are processed in batches of AHCFOP_BATCH_SIZE:  each batch sends
    that many page images in a single LLM request, then runs up to
    HISTORIC_VERIFY_MAX_ATTEMPTS total LLM calls (1 extraction + N-1 corrections).
    
    AHCFOP mode uses a local Ollama model. If no model is specified via --model,
    uses OLLAMA_DEFAULT_MODEL. Change OLLAMA_DEFAULT_MODEL if you have a different
    model installed locally.
    """
    # For AHCFOP, use local Ollama model, not OpenRouter
    if not args.model:
        model = OLLAMA_DEFAULT_MODEL
        logger.info(f"AHCFOP mode uses local Ollama. Using default model: {model}")
    
    script_dir = Path(__file__).parent
    ahcfop_dir = script_dir / 'bulletins' / 'historic' / AHCFOP_FOLDER_NAME

    if not ahcfop_dir.exists():
        logger.error(f"AHCFOP bulletin directory not found: {ahcfop_dir}")
        return 1

    # Find the churches that belong to this family
    ahcfop_churches = [
        c for c in churches
        if 'ahcfop' in c.get('bulletin_website', '').lower()
    ]
    if not ahcfop_churches:
        logger.error("No churches found with ahcfop.ca bulletin website in churches.json")
        return 1

    church_names_list = [c.get('name', 'Unknown') for c in ahcfop_churches]
    churches_context = intentions.prepare_churches_context(ahcfop_churches)

    logger.info(f"AHCFOP churches: {', '.join(church_names_list)}")
    logger.info(f"Source directory: {ahcfop_dir}")
    logger.info(f"Intentions page: {AHCFOP_INTENTIONS_PAGE} | Batch size: {AHCFOP_BATCH_SIZE}")
    logger.info(f"Model: {model}")

    # Get all PDFs sorted numerically (bulletin_1, bulletin_2, … bulletin_262)
    pdf_files = sorted(
        ahcfop_dir.glob('bulletin_*.pdf'),
        key=lambda f: int(f.stem.split('_')[1]),
    )

    if not pdf_files:
        logger.warning(f"No bulletin PDFs found in {ahcfop_dir}")
        return 0

    logger.info(f"Found {len(pdf_files)} bulletins to process")

    # Load existing intentions
    existing_intentions = intentions.load_intentions_json(str(intentions_path))
    all_extracted: list = []
    report_results: list = []

    total_batches = (len(pdf_files) + AHCFOP_BATCH_SIZE - 1) // AHCFOP_BATCH_SIZE

    for batch_idx, batch_start in enumerate(range(0, len(pdf_files), AHCFOP_BATCH_SIZE), 1):
        batch_files = pdf_files[batch_start: batch_start + AHCFOP_BATCH_SIZE]
        batch_label = f"[{batch_idx}/{total_batches}]"

        logger.info(
            f"\n--- Batch {batch_label}: "
            f"{batch_files[0].name} … {batch_files[-1].name} "
            f"({len(batch_files)} bulletins) ---"
        )

        # Extract the target page from each bulletin in the batch
        labeled_pages = []
        for pdf_file in batch_files:
            img = _get_pdf_page_image(str(pdf_file), AHCFOP_INTENTIONS_PAGE)
            if img is not None:
                labeled_pages.append((pdf_file.name, img))
            else:
                logger.warning(f"Skipping {pdf_file.name} (page {AHCFOP_INTENTIONS_PAGE} unavailable)")

        if not labeled_pages:
            logger.warning(f"Batch {batch_label}: no pages could be extracted, skipping")
            continue

        logger.info(
            f"Extracted page {AHCFOP_INTENTIONS_PAGE} from "
            f"{len(labeled_pages)}/{len(batch_files)} bulletins"
        )

        # --- Extraction + verification loop for this batch ---
        extracted_batch = None

        # For AHCFOP batches, prefer a local Ollama backend. Use env OLLAMA_API_URL to override.
        ollama_url = os.getenv('OLLAMA_API_URL', 'http://localhost:11434')
        use_ollama = True

        for attempt in range(1, HISTORIC_VERIFY_MAX_ATTEMPTS + 1):
            if attempt == 1:
                logger.info(
                    f"Extracting intentions (attempt 1/{HISTORIC_VERIFY_MAX_ATTEMPTS}) "
                    f"for batch {batch_label}... (using Ollama: {use_ollama})"
                )
                if use_ollama:
                    try:
                        extracted_batch = _extract_batch_via_ollama(labeled_pages, churches_context, model, ollama_url, logger)
                    except Exception as e:
                        logger.error(f"Batch {batch_label}: Ollama extraction raised: {e}")
                        extracted_batch = None
                else:
                    extracted_batch = llm.extract_intentions_from_page_batch(
                        labeled_pages, churches_context, model=model
                    )

                if extracted_batch is None:
                    logger.error(f"Batch {batch_label}: initial extraction call failed")
                    extracted_batch = []
                    break
                if not extracted_batch:
                    logger.info(f"Batch {batch_label}: no intentions found")
                    break
            else:
                verify_pass = attempt - 1
                logger.info(
                    f"Verification pass {verify_pass}/{HISTORIC_VERIFY_MAX_ATTEMPTS - 1} "
                    f"for batch {batch_label}... (using Ollama: {use_ollama})"
                )
                try:
                    if use_ollama:
                        is_verified, corrected = _verify_batch_via_ollama(labeled_pages, churches_context, extracted_batch, model, ollama_url, logger)
                    else:
                        is_verified, corrected = llm.verify_intentions_from_page_batch(
                            labeled_pages, churches_context, extracted_batch, model=model
                        )
                except Exception as e:
                    logger.error(
                        f"Batch {batch_label}: verification pass {verify_pass} raised "
                        f"an exception: {e}. Proceeding with current result."
                    )
                    break

                extracted_batch = corrected

                if is_verified:
                    logger.info(
                        f"✓ Batch {batch_label} verified after {verify_pass} pass(es)"
                    )
                    break

                if attempt < HISTORIC_VERIFY_MAX_ATTEMPTS:
                    logger.info(
                        f"Batch {batch_label}: corrections applied, "
                        f"continuing to next verification pass..."
                    )
                else:
                    logger.warning(
                        f"Batch {batch_label}: reached max attempts "
                        f"({HISTORIC_VERIFY_MAX_ATTEMPTS}), proceeding with best result"
                    )

        if not extracted_batch:
            continue

        # Build a map from filename -> local path for metadata
        pdf_path_map = {f.name: str(f) for f in batch_files}

        # Strip source_bulletin, add standard metadata, accumulate
        batch_entries: list = []
        for entry in extracted_batch:
            source_filename = entry.pop('source_bulletin', None)
            local_path = pdf_path_map.get(source_filename, str(ahcfop_dir))
            intentions.add_intention_metadata(entry, local_path)
            batch_entries.append(entry)

        masses_count = len(batch_entries)
        int_count = sum(len(e.get('intentions', [])) for e in batch_entries)
        logger.info(
            f"Batch {batch_label}: {int_count} intentions across {masses_count} Masses"
        )

        all_extracted.extend(batch_entries)

        # One report entry per batch (groups all masses from this batch together)
        batch_file_labels = ', '.join(f.name for f in batch_files)
        report_results.append({
            'pdf_link': f"Batch {batch_idx}: {batch_file_labels}",
            'church_names': church_names_list,
            'intentions': batch_entries,
        })

    # Merge with existing intentions
    merged = intentions.merge_intentions(existing_intentions, all_extracted)

    # Write report
    try:
        write_intentions_report(output_path, report_results)
        logger.info(f"AHCFOP extraction complete. Report saved to {output_path}")
    except Exception as e:
        logger.error(f"Failed to write intentions report: {e}")
        return 1

    # Save to JSON if --modify-json was requested
    if args.modify_json:
        logger.info("--modify-json flag set. Saving intentions...")
        try:
            intentions.save_intentions_json(merged, str(intentions_path))
            logger.info(f"✓ Saved to: {intentions_path}")
        except Exception as e:
            logger.error(f"Failed to save intentions JSON: {e}")
            return 1

    total_masses = len(all_extracted)
    total_int = sum(len(e.get('intentions', [])) for e in all_extracted)
    logger.info(
        f"\nAHCFOP complete: {total_int} intentions across {total_masses} Masses "
        f"from {len(pdf_files)} bulletins ({total_batches} batches)"
    )
    logger.info(f"Total intention entries after merge: {len(merged)}")

    return 0


# ---------------------------------------------------------------------------
# Standalone entry point
# ---------------------------------------------------------------------------

def _build_parser():
    """Build the argument parser for standalone use."""
    parser = argparse.ArgumentParser(
        description='Custom bulletin analysis commands (historic intentions extraction)'
    )

    mode_group = parser.add_mutually_exclusive_group(required=True)
    mode_group.add_argument(
        '--historic',
        action='store_true',
        help=(
            'Scan ALL prior bulletins for every family of parishes '
            f'(uses free model "{HISTORIC_INTENTIONS_MODEL}" unless --model is set)'
        ),
    )
    mode_group.add_argument(
        '--historic-ahcfop',
        action='store_true',
        dest='historic_ahcfop',
        help=(
            f'Extract intentions from pre-downloaded AHCFOP bulletins in '
            f'{AHCFOP_FOLDER_NAME}/ using batches of {AHCFOP_BATCH_SIZE} page-'
            f'{AHCFOP_INTENTIONS_PAGE} images per LLM request '
            f'(uses free model "{HISTORIC_INTENTIONS_MODEL}" unless --model is set)'
        ),
    )

    parser.add_argument(
        '--log-level',
        default='INFO',
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
        help='Logging level (default: INFO)',
    )
    parser.add_argument(
        '--churches-path',
        default='../public/churches.json',
        help='Path to churches.json (default: ../public/churches.json)',
    )
    parser.add_argument(
        '--intentions-path',
        default='../public/intentions.json',
        help='Path to intentions.json for loading existing data and saving results '
             '(default: ../public/intentions.json)',
    )
    parser.add_argument(
        '--output',
        default=None,
        help='Output Markdown report file (default: intentions_analysis.md)',
    )
    parser.add_argument(
        '--workers',
        type=int,
        default=10,
        help='Parallel workers for historic mode (default: 10)',
    )
    parser.add_argument(
        '--model',
        default=None,
        help=f'LLM model override (default: {HISTORIC_INTENTIONS_MODEL})',
    )
    parser.add_argument(
        '--modify-json',
        action='store_true',
        help='Save extracted intentions to --intentions-path',
    )
    parser.add_argument(
        '--no-images',
        action='store_true',
        help='Use PDF mode instead of image mode for historic (not applicable to ahcfop batch)',
    )

    return parser


def main():
    """Standalone entry point."""
    parser = _build_parser()
    args = parser.parse_args()

    log_level = getattr(logging, args.log_level)
    logger = setup_logging(log_level)

    script_dir = Path(__file__).parent
    churches_path = script_dir / args.churches_path
    intentions_path = script_dir / args.intentions_path
    output_path = script_dir / (args.output or 'intentions_analysis.md')

    model = args.model or HISTORIC_INTENTIONS_MODEL

    if not churches_path.exists():
        logger.error(f"churches.json not found at {churches_path}")
        return 1

    try:
        churches = scraping.load_churches_json(str(churches_path))
        logger.info(f"Loaded {len(churches)} churches")
    except Exception as e:
        logger.error(f"Failed to load churches: {e}")
        return 1

    use_images = not args.no_images

    if args.historic:
        logger.info(f"Historic mode: processing all families using model '{model}'")
        return run_historic_intentions_mode(
            args, logger, churches, intentions_path, output_path, use_images, model
        )

    if args.historic_ahcfop:
        logger.info(f"Historic AHCFOP mode: batch-extracting from {AHCFOP_FOLDER_NAME}/ using model '{model}'")
        return run_historic_ahcfop_mode(
            args, logger, churches, intentions_path, output_path, model
        )

    logger.error("No mode selected.")
    return 1


if __name__ == '__main__':
    sys.exit(main())
