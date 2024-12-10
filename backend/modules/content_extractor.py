from bs4 import BeautifulSoup
import logging
import re
from urllib.parse import urljoin, urlparse
from typing import Dict, List, Set, Optional
import httpx
import asyncio

logger = logging.getLogger(__name__)

class ContentExtractor:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.domain = urlparse(base_url).netloc
        self.visited_urls: Set[str] = set()
        self.internal_links_to: Dict[str, List[Dict[str, str]]] = {}
        self.internal_links_from: Dict[str, List[Dict[str, str]]] = {}

    async def extract_page_content(self, url: str) -> Dict:
        """Extract content from a single page."""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                html = response.text
            
            soup = BeautifulSoup(html, 'html.parser')
            
            # Extract main content
            main_content = self._extract_main_content(soup)
            internal_links = self._extract_internal_links(soup, url)
            external_links = self._extract_external_links(soup, url)
            
            return {
                'url': url,
                'title': soup.title.string if soup.title else '',
                'content': main_content,
                'internal_links': internal_links,
                'external_links': external_links
            }
        except Exception as e:
            logger.error(f"Error extracting content from {url}: {str(e)}")
            raise

    def _extract_main_content(self, soup: BeautifulSoup) -> str:
        """Extract main content from HTML."""
        # Try to find main content area
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

    def _extract_internal_links(self, soup: BeautifulSoup, current_url: str) -> List[Dict[str, str]]:
        """Extract internal links with context."""
        internal_links = []
        
        for link in soup.find_all('a', href=True):
            href = link.get('href', '').strip()
            if not href or href.startswith(('#', 'javascript:', 'mailto:', 'tel:')):
                continue
                
            try:
                absolute_url = urljoin(current_url, href)
                if urlparse(absolute_url).netloc == self.domain:
                    # Get surrounding context
                    context = self._get_link_context(link)
                    internal_links.append({
                        'url': absolute_url,
                        'text': link.get_text(strip=True),
                        'context': context
                    })
            except Exception as e:
                logger.error(f"Error processing internal link {href}: {str(e)}")
                
        return internal_links

    def _extract_external_links(self, soup: BeautifulSoup, current_url: str) -> List[Dict[str, str]]:
        """Extract external links with context."""
        external_links = []
        
        for link in soup.find_all('a', href=True):
            href = link.get('href', '').strip()
            if not href or href.startswith(('#', 'javascript:', 'mailto:', 'tel:')):
                continue
                
            try:
                absolute_url = urljoin(current_url, href)
                if urlparse(absolute_url).netloc != self.domain:
                    context = self._get_link_context(link)
                    external_links.append({
                        'url': absolute_url,
                        'text': link.get_text(strip=True),
                        'context': context
                    })
            except Exception as e:
                logger.error(f"Error processing external link {href}: {str(e)}")
                
        return external_links

    def _get_link_context(self, link_element) -> str:
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

    async def analyze_site_links(self, start_url: str, max_pages: int = 50) -> Dict:
        """Analyze internal linking structure starting from a URL."""
        self.visited_urls.clear()
        self.internal_links_to.clear()
        self.internal_links_from.clear()
        
        try:
            # First get the main page content
            main_content = await self.extract_page_content(start_url)
            
            # Then crawl other pages to analyze internal linking
            to_visit = {link['url'] for link in main_content['internal_links']}
            while to_visit and len(self.visited_urls) < max_pages:
                current_url = to_visit.pop()
                if current_url in self.visited_urls:
                    continue
                    
                try:
                    page_content = await self.extract_page_content(current_url)
                    self.visited_urls.add(current_url)
                    
                    # Track links pointing to our target page
                    for link in page_content['internal_links']:
                        if link['url'] == start_url:
                            if start_url not in self.internal_links_to:
                                self.internal_links_to[start_url] = []
                            self.internal_links_to[start_url].append({
                                'source_url': current_url,
                                'anchor_text': link['text'],
                                'context': link['context']
                            })
                            
                    # Add new internal links to visit
                    to_visit.update({
                        link['url'] for link in page_content['internal_links']
                        if link['url'] not in self.visited_urls
                    })
                except Exception as e:
                    logger.error(f"Error analyzing page {current_url}: {str(e)}")
                    continue
                    
                # Small delay to be nice to the server
                await asyncio.sleep(0.5)
            
            return {
                'main_content': main_content,
                'inbound_links': self.internal_links_to.get(start_url, []),
                'outbound_links': main_content['internal_links'],
                'external_links': main_content['external_links'],
                'pages_analyzed': len(self.visited_urls)
            }
            
        except Exception as e:
            logger.error(f"Error in site analysis: {str(e)}")
            raise

def extract_content(url: str) -> Dict:
    """Main function to extract and analyze content."""
    try:
        extractor = ContentExtractor(url)
        return asyncio.run(extractor.analyze_site_links(url))
    except Exception as e:
        logger.error(f"Error in content extraction: {str(e)}")
        raise