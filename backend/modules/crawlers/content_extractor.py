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

    async def analyze_site_links(self, start_url: str, max_pages: int = 50) -> Dict:
        """Analyze internal linking structure starting from a URL."""
        try:
            logger.info(f"Starting site analysis from {start_url}")
            
            # First crawl the entire site to build the link graph
            crawl_results = await self.crawl_site(max_pages)
            logger.info(f"Site crawl complete. Analyzing {len(crawl_results['pages'])} pages")
            
            # Get the main content for the target page
            main_content = await self.extract_page_content(start_url)
            
            # Find all inbound links to our target page
            inbound_links = []
            for source_url, page_links in crawl_results['link_graph'].items():
                for link in page_links:
                    if link['url'] == start_url:
                        inbound_links.append({
                            'source_url': source_url,
                            'anchor_text': link['text'],
                            'context': link['context']
                        })
            
            logger.info(f"Found {len(inbound_links)} inbound links to {start_url}")
            
            return {
                'main_content': main_content,
                'inbound_links': inbound_links,
                'outbound_links': main_content['internal_links'],
                'external_links': main_content['external_links'],
                'pages_analyzed': len(crawl_results['pages'])
            }
            
        except Exception as e:
            logger.error(f"Error in site analysis: {str(e)}")
            raise

    async def extract_page_content(self, url: str) -> Dict:
        """Extract content from a single page."""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                html = response.text
            
            soup = BeautifulSoup(html, 'html.parser')
            
            # Extract main content and links
            main_content = self._extract_content(soup)
            links = self._extract_links(soup, url)
            
            # Separate internal and external links
            internal_links = [link for link in links if link['is_internal']]
            external_links = [link for link in links if not link['is_internal']]
            
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

def extract_content(url: str) -> Dict:
    """Main function to extract and analyze content."""
    try:
        extractor = ContentExtractor(url)
        return asyncio.run(extractor.analyze_site_links(url))
    except Exception as e:
        logger.error(f"Error in content extraction: {str(e)}")
        raise