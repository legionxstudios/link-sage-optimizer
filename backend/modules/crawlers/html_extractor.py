from bs4 import BeautifulSoup
import logging
from typing import Dict, List, Optional
from urllib.parse import urljoin

logger = logging.getLogger(__name__)

class HTMLExtractor:
    @staticmethod
    def extract_main_content(soup: BeautifulSoup) -> str:
        """Extract readable text content from HTML while excluding code blocks."""
        # First remove all script and style elements
        for element in soup.find_all(['script', 'style', 'code', 'pre']):
            element.decompose()
            
        # Get the body content
        body = soup.body
        if not body:
            return ""
            
        # Find main content area if it exists
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
            content_area = body
            
        # Extract text from content elements, focusing on readable content
        content_elements = content_area.find_all(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th', 'div'])
        paragraphs = []
        
        for element in content_elements:
            # Skip navigation, header, footer, etc.
            if any(cls in str(element.get('class', [])).lower() 
                  for cls in ['nav', 'header', 'footer', 'sidebar', 'menu', 'code', 'syntax']):
                continue
                
            # Get clean text without extra whitespace
            text = ' '.join(element.get_text().split())
            if len(text) > 0:  # Keep all non-empty paragraphs
                paragraphs.append(text)
                
        return '\n\n'.join(paragraphs)

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
                
                if domain in absolute_url:
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