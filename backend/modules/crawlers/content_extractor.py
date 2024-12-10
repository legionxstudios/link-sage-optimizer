import httpx
import asyncio
import logging
from bs4 import BeautifulSoup
from typing import Dict, List, Optional
from .base_crawler import BaseCrawler
from .html_extractor import HTMLExtractor

logger = logging.getLogger(__name__)

class ContentExtractor(BaseCrawler):
    def __init__(self, base_url: str):
        super().__init__(base_url)
        self.html_extractor = HTMLExtractor()

    async def extract_page_content(self, url: str) -> Dict:
        """Extract content from a single page."""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                html = response.text
            
            soup = BeautifulSoup(html, 'html.parser')
            
            # Extract main content and links
            main_content = self.html_extractor.extract_main_content(soup)
            links = self.html_extractor.extract_links(soup, url, self.domain)
            
            return {
                'url': url,
                'title': soup.title.string if soup.title else '',
                'content': main_content,
                'internal_links': links['internal_links'],
                'external_links': links['external_links']
            }
        except Exception as e:
            logger.error(f"Error extracting content from {url}: {str(e)}")
            raise

    async def analyze_site_links(self, start_url: str, max_pages: int = 50) -> Dict:
        """Analyze internal linking structure starting from a URL."""
        self.visited_urls.clear()
        inbound_links = []
        
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
                            inbound_links.append({
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
                'inbound_links': inbound_links,
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