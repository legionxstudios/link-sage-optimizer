from bs4 import BeautifulSoup
import logging
from typing import Dict, List, Optional
from urllib.parse import urljoin

logger = logging.getLogger(__name__)

class HTMLExtractor:
    @staticmethod
    def extract_main_content(soup: BeautifulSoup) -> str:
        """Extract main content from HTML."""
        content_selectors = [
            'article', 'main', '[role="main"]',
            '.post-content', '.entry-content', '.content'
        ]
        
        content_area = None
        for selector in content_selectors:
            content_area = soup.select_one(selector)
            if content_area:
                break
        
        if not content_area:
            content_area = soup.body
        
        if not content_area:
            return ""
            
        # Extract text from paragraphs
        paragraphs = []
        for p in content_area.find_all(['p', 'article', 'section']):
            text = p.get_text(strip=True)
            if len(text) > 50:  # Only keep substantial paragraphs
                paragraphs.append(text)
        
        return ' '.join(paragraphs)

    @staticmethod
    def extract_links(soup: BeautifulSoup, current_url: str, domain: str) -> Dict[str, List[Dict]]:
        """Extract both internal and external links with context."""
        internal_links = []
        external_links = []
        
        for link in soup.find_all('a', href=True):
            href = link.get('href', '').strip()
            if not href or href.startswith(('#', 'javascript:', 'mailto:', 'tel:')):
                continue
                
            try:
                absolute_url = urljoin(current_url, href)
                context = HTMLExtractor._get_link_context(link)
                link_data = {
                    'url': absolute_url,
                    'text': link.get_text(strip=True),
                    'context': context
                }
                
                if urlparse(absolute_url).netloc == domain:
                    internal_links.append(link_data)
                else:
                    external_links.append(link_data)
                    
            except Exception as e:
                logger.error(f"Error processing link {href}: {str(e)}")
                
        return {
            'internal_links': internal_links,
            'external_links': external_links
        }

    @staticmethod
    def _get_link_context(link_element) -> str:
        """Get the surrounding context of a link."""
        parent = link_element.find_parent(['p', 'div', 'section'])
        if parent:
            # Get text before and after the link
            html = str(parent)
            link_html = str(link_element)
            parts = html.split(link_html)
            
            if len(parts) >= 2:
                before = BeautifulSoup(parts[0], 'html.parser').get_text(strip=True)
                after = BeautifulSoup(parts[1], 'html.parser').get_text(strip=True)
                
                # Limit context length
                before = before[-100:] if len(before) > 100 else before
                after = after[:100] if len(after) > 100 else after
                
                return f"{before} [LINK] {after}"
        
        return ""