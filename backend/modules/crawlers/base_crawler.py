import logging
from urllib.parse import urlparse, urljoin
from typing import Dict, Set, List
import asyncio
import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

class BaseCrawler:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.domain = urlparse(base_url).netloc
        self.visited_urls: Set[str] = set()
        self.link_graph: Dict[str, List[Dict]] = {}
        self.page_contents: Dict[str, Dict] = {}
        
    async def crawl_site(self, max_pages: int = 100) -> Dict:
        """Crawl the entire site and build a link graph."""
        try:
            logger.info(f"Starting site crawl from {self.base_url}")
            to_visit = {self.base_url}
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                while to_visit and len(self.visited_urls) < max_pages:
                    current_url = to_visit.pop()
                    if current_url in self.visited_urls:
                        continue
                        
                    try:
                        logger.info(f"Crawling {current_url}")
                        response = await client.get(current_url)
                        response.raise_for_status()
                        
                        soup = BeautifulSoup(response.text, 'html.parser')
                        self.visited_urls.add(current_url)
                        
                        # Extract and store page content
                        content = self._extract_content(soup)
                        self.page_contents[current_url] = {
                            'title': soup.title.string if soup.title else '',
                            'content': content,
                            'url': current_url
                        }
                        
                        # Process links and update graph
                        links = self._extract_links(soup, current_url)
                        self.link_graph[current_url] = links
                        
                        # Add new internal links to visit
                        new_urls = {
                            link['url'] for link in links 
                            if self._is_internal_url(link['url']) and 
                            link['url'] not in self.visited_urls
                        }
                        to_visit.update(new_urls)
                        
                        # Small delay to be nice to the server
                        await asyncio.sleep(0.5)
                        
                    except Exception as e:
                        logger.error(f"Error crawling {current_url}: {str(e)}")
                        continue
                        
            logger.info(f"Crawl complete. Visited {len(self.visited_urls)} pages")
            return {
                'pages': self.page_contents,
                'link_graph': self.link_graph,
                'crawled_pages': len(self.visited_urls)
            }
            
        except Exception as e:
            logger.error(f"Error in site crawl: {str(e)}")
            raise
            
    def _extract_content(self, soup: BeautifulSoup) -> str:
        """Extract main content from HTML."""
        content_selectors = [
            'article', 'main', '[role="main"]',
            '.post-content', '.entry-content', '.content',
            '.article-content', '#content', '[itemprop="articleBody"]'
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
            
        # Extract text from content elements
        content_elements = content_area.find_all(['p', 'article', 'section', 'div'])
        paragraphs = []
        
        for element in content_elements:
            # Skip navigation, header, footer, etc.
            if any(cls in str(element.get('class', [])).lower() 
                  for cls in ['nav', 'header', 'footer', 'sidebar', 'menu']):
                continue
                
            text = element.get_text(strip=True)
            if len(text) > 0:  # Keep all non-empty paragraphs
                paragraphs.append(text)
                
        return '\n\n'.join(paragraphs)
        
    def _extract_links(self, soup: BeautifulSoup, current_url: str) -> List[Dict]:
        """Extract all links with context."""
        links = []
        for link in soup.find_all('a', href=True):
            href = link.get('href', '').strip()
            if not href or href.startswith(('#', 'javascript:', 'mailto:', 'tel:')):
                continue
                
            try:
                absolute_url = urljoin(current_url, href)
                context = self._get_link_context(link)
                
                links.append({
                    'url': absolute_url,
                    'text': link.get_text(strip=True),
                    'context': context,
                    'is_internal': self._is_internal_url(absolute_url)
                })
                
            except Exception as e:
                logger.error(f"Error processing link {href}: {str(e)}")
                
        return links
        
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
                before = before[-150:] if len(before) > 150 else before
                after = after[:150] if len(after) > 150 else after
                
                return f"{before} [LINK] {after}"
        
        return ""
        
    def _is_internal_url(self, url: str) -> bool:
        """Check if URL belongs to the same domain."""
        try:
            return urlparse(url).netloc == self.domain
        except Exception as e:
            logger.error(f"Error parsing URL {url}: {str(e)}")
            return False
            
    def _clean_url(self, url: str) -> str:
        """Clean and normalize URL."""
        try:
            parsed = urlparse(url)
            return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        except Exception as e:
            logger.error(f"Error cleaning URL {url}: {str(e)}")
            return url