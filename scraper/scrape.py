import json
import os
from datetime import datetime
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import cloudscraper
import time

"""
BULLETIN SCRAPER - Using Cloudscraper (Handles Cloudflare)

This version uses cloudscraper to bypass Cloudflare protection
and extract bulletin PDF links from church websites.
"""

# Load churches data
churches_path = os.path.join(os.path.dirname(__file__), '..', 'static', 'churches.json')
with open(churches_path, 'r') as f:
    churches = json.load(f)

# Create timestamped output files
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
output_file_detailed = os.path.join(os.path.dirname(__file__), f'bulletins_detailed_{timestamp}.txt')
output_file_simple = os.path.join(os.path.dirname(__file__), f'bulletins_{timestamp}.txt')

# Store bulletin links and their sources
bulletin_data = []
# Cache: map of bulletin_website -> pdf_link to avoid duplicate scraping
website_cache = {}


def scrape_bulletin(church_name, bulletin_website):
    """Scrape a single church's bulletin page using cloudscraper"""
    
    print(f"📄 {church_name}")
    print(f"   URL: {bulletin_website}")
    
    try:
        pdf_links = []
        first_pdf = None
        
        # Use cloudscraper to bypass Cloudflare
        scraper = cloudscraper.create_scraper()
        response = scraper.get(bulletin_website, timeout=15)
        response.raise_for_status()
        
        # Parse HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Find all links with .pdf in href
        preferred_domains = ['parishbulletins.com', 'files.ecatholic.com']
        preferred_pdfs = []
        other_pdfs = []
        
        for link in soup.find_all('a', href=True):
            href = link.get('href', '')
            if '.pdf' in href.lower():
                absolute_url = urljoin(bulletin_website, href)
                
                # Check if URL is from a preferred domain
                is_preferred = any(domain in absolute_url for domain in preferred_domains)
                if is_preferred:
                    preferred_pdfs.append(absolute_url)
                else:
                    other_pdfs.append(absolute_url)
        
        # Prioritize preferred domains, fallback to others
        all_pdfs = preferred_pdfs + other_pdfs
        if all_pdfs:
            first_pdf = all_pdfs[0]
            pdf_links = all_pdfs
        
        # Store result
        if first_pdf:
            print(f"   ✓ Found PDF: {first_pdf}")
            cache_entry = {'pdf_link': first_pdf}
            website_cache[bulletin_website] = cache_entry
            bulletin_data.append({
                'church': church_name,
                'bulletin_website': bulletin_website,
                'pdf_link': first_pdf,
                'timestamp': datetime.now().isoformat(),
                'all_pdf_links': pdf_links if len(pdf_links) > 1 else None
            })
        else:
            print(f"   ✗ No PDF links found")
            cache_entry = {'pdf_link': None}
            website_cache[bulletin_website] = cache_entry
            bulletin_data.append({
                'church': church_name,
                'bulletin_website': bulletin_website,
                'pdf_link': None,
                'timestamp': datetime.now().isoformat(),
                'note': 'No PDF links found on page'
            })
    
    except Exception as e:
        error_msg = str(e)
        print(f"   ✗ Error: {error_msg}")
        cache_entry = {'pdf_link': None, 'error': error_msg}
        website_cache[bulletin_website] = cache_entry
        bulletin_data.append({
            'church': church_name,
            'bulletin_website': bulletin_website,
            'pdf_link': None,
            'timestamp': datetime.now().isoformat(),
            'error': error_msg
        })


def main():
    """Main scraping function"""
    
    print(f"Starting bulletin scraping (cloudscraper) at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Detailed output: {output_file_detailed}")
    print(f"Simple output: {output_file_simple}")
    print("-" * 80)
    
    # Process each church
    for church in churches:
        church_name = church.get('name', 'Unknown')
        bulletin_website = church.get('bulletin_website', '')
        
        # Skip if no bulletin website or if it's N/A
        if not bulletin_website or bulletin_website == 'N/A':
            print(f"⊘ {church_name}: No bulletin website")
            continue
        
        # Check if we already scraped this website
        if bulletin_website in website_cache:
            print(f"📄 {church_name} (cached)")
            print(f"   URL: {bulletin_website}")
            cached_result = website_cache[bulletin_website]
            if cached_result['pdf_link']:
                print(f"   ✓ Found PDF: {cached_result['pdf_link']}")
            else:
                print(f"   ✗ No PDF links found")
            bulletin_data.append({
                'church': church_name,
                'bulletin_website': bulletin_website,
                'pdf_link': cached_result['pdf_link'],
                'timestamp': datetime.now().isoformat(),
                'note': 'Retrieved from cache'
            })
        else:
            # Scrape this website for the first time
            scrape_bulletin(church_name, bulletin_website)
        
        # Be polite - delay between requests
        time.sleep(0.5)
    
    print("-" * 80)
    
    # Write detailed results to file
    with open(output_file_detailed, 'w', encoding='utf-8') as f:
        f.write(f"Bulletin Links (Detailed) - {timestamp}\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write("=" * 80 + "\n\n")
        
        for entry in bulletin_data:
            f.write(f"Church: {entry['church']}\n")
            f.write(f"Bulletin Website: {entry['bulletin_website']}\n")
            
            if entry.get('pdf_link'):
                f.write(f"PDF Link: {entry['pdf_link']}\n")
            
            if entry.get('all_pdf_links'):
                f.write(f"All PDF Links Found:\n")
                for i, link in enumerate(entry['all_pdf_links'], 1):
                    f.write(f"  {i}. {link}\n")
            
            if entry.get('note'):
                f.write(f"Note: {entry['note']}\n")
            
            if entry.get('error'):
                f.write(f"Error: {entry['error']}\n")
            
            f.write("\n" + "-" * 80 + "\n\n")
    
    # Write simple key-pair results to file
    with open(output_file_simple, 'w', encoding='utf-8') as f:
        f.write(f"Bulletin Links (Simple) - {timestamp}\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write("=" * 80 + "\n\n")
        f.write("Bulletin Website | PDF Link\n")
        f.write("-" * 80 + "\n")
        
        for website, result in website_cache.items():
            pdf_link = result.get('pdf_link') or 'NOT FOUND'
            f.write(f"{website} | {pdf_link}\n")
    
    print(f"Detailed results saved to: {output_file_detailed}")
    print(f"Simple results saved to: {output_file_simple}")
    print(f"Completed at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == '__main__':
    main()
