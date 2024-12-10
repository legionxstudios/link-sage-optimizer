from bs4 import BeautifulSoup
import logging
import re
from typing import Dict, List, Set
from urllib.parse import urljoin, urlparse

logger = logging.getLogger(__name__)

def clean_content(text: str) -> str:
    """Clean extracted content."""
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'[^\w\s.,!?-]', '', text)
    return text.strip()

def is_same_domain(url1: str, url2: str) -> bool:
    """Check if two URLs belong to the same domain."""
    try:
        domain1 = urlparse(url1).netloc
        domain2 = urlparse(url2).netloc
        return domain1 == domain2
    except:
        return False

def extract_content(response_text: str, base_url: str = "") -> dict:
    """Extract meaningful content and analyze links from HTML."""
    try:
        logger.info(f"Starting content extraction for URL: {base_url}")
        soup = BeautifulSoup(response_text, 'html.parser')
        
        # Extract title
        title = soup.title.string if soup.title else ""
        logger.info(f"Extracted title: {title}")
        
        # First try to find the main content area
        content_selectors = [
            'article', 'main', '[role="main"]', '.post-content',
            '.entry-content', '.article-content', '.content', '#content'
        ]
        
        content_area = None
        for selector in content_selectors:
            content_area = soup.select_one(selector)
            if content_area:
                logger.info(f"Found main content area using selector: {selector}")
                break
        
        if not content_area:
            logger.info("No specific content area found, using body")
            content_area = soup.body if soup.body else soup
        
        # Extract all links from the entire document
        internal_links: Set[str] = set()
        external_links: Set[str] = set()
        
        all_links = soup.find_all('a', href=True)
        logger.info(f"Found {len(all_links)} total links in document")
        
        for link in all_links:
            href = link.get('href', '').strip()
            if href and not href.startswith(('#', 'javascript:', 'mailto:', 'tel:')):
                try:
                    absolute_url = urljoin(base_url, href)
                    if is_same_domain(base_url, absolute_url):
                        internal_links.add(absolute_url)
                        logger.debug(f"Added internal link: {absolute_url}")
                    else:
                        external_links.add(absolute_url)
                        logger.debug(f"Added external link: {absolute_url}")
                except Exception as e:
                    logger.error(f"Error processing link {href}: {str(e)}")
        
        logger.info(f"Processed links - Internal: {len(internal_links)}, External: {len(external_links)}")
        
        # Extract paragraphs from content area
        paragraphs = []
        for p in content_area.find_all(['p', 'article', 'section', 'div']):
            # Skip if the element contains mostly links
            links_text_length = sum(len(a.get_text(strip=True)) for a in p.find_all('a'))
            total_text_length = len(p.get_text(strip=True))
            
            if total_text_length > 0 and links_text_length / total_text_length < 0.5:
                text = p.get_text(strip=True)
                if len(text) > 50:  # Only keep substantial paragraphs
                    paragraphs.append(text)
        
        logger.info(f"Extracted {len(paragraphs)} substantial paragraphs")
        
        # Combine paragraphs into main content
        main_content = ' '.join(paragraphs)
        main_content = clean_content(main_content)
        
        logger.info(f"Final content length: {len(main_content)} characters")
        
        result = {
            'title': title,
            'content': main_content,
            'paragraphs': paragraphs,
            'internal_links': list(internal_links),
            'external_links': list(external_links),
            'total_links': len(internal_links) + len(external_links)
        }
        
        logger.info("Content extraction completed successfully")
        return result
        
    except Exception as e:
        logger.error(f"Error extracting content: {str(e)}")
        raise