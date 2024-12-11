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
        self.retry_count = 3
        self.retry_delay = 1  # seconds

    async def analyze_site_links(self, start_url: str, max_pages: int = 50) -> Dict:
        """Analyze internal linking structure starting from a URL."""
        try:
            logger.info(f"Starting site analysis from {start_url}")
            
            # First crawl the entire site to build the link graph
            crawl_results = await self.crawl_site(max_pages)
            logger.info(f"Site crawl complete. Analyzing {len(crawl_results['pages'])} pages")
            
            # Get the main content for the target page
            main_content = await self._retry_with_backoff(
                self.extract_page_content,
                start_url
            )
            
            if not main_content:
                raise ValueError("Failed to extract main content after retries")

            logger.info(f"Main content extracted, length: {len(main_content.get('content', ''))}")
            
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
            logger.error(f"Error in site analysis: {str(e)}", exc_info=True)
            raise

    async def _retry_with_backoff(self, func, *args, **kwargs):
        """Retry a function with exponential backoff."""
        for attempt in range(self.retry_count):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                if attempt == self.retry_count - 1:
                    logger.error(f"Final retry attempt failed: {str(e)}", exc_info=True)
                    raise
                wait_time = self.retry_delay * (2 ** attempt)
                logger.warning(f"Attempt {attempt + 1} failed, retrying in {wait_time}s: {str(e)}")
                await asyncio.sleep(wait_time)

    async def extract_page_content(self, url: str) -> Dict:
        """Extract content from a single page."""
        logger.info(f"Extracting content from {url}")
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                html = response.text
                
                if not html.strip():
                    raise ValueError("Received empty HTML response")
            
            soup = BeautifulSoup(html, 'html.parser')
            
            # Extract main content and links
            main_content = self._extract_content(soup)
            if not main_content.strip():
                logger.warning(f"No main content extracted from {url}")
            
            links = self._extract_links(soup, url)
            
            # Separate internal and external links
            internal_links = [link for link in links if link['is_internal']]
            external_links = [link for link in links if not link['is_internal']]
            
            logger.info(f"Extracted {len(internal_links)} internal and {len(external_links)} external links")
            
            return {
                'url': url,
                'title': soup.title.string if soup.title else '',
                'content': main_content,
                'internal_links': internal_links,
                'external_links': external_links
            }
        except httpx.HTTPError as e:
            logger.error(f"HTTP error extracting content from {url}: {str(e)}", exc_info=True)
            raise
        except Exception as e:
            logger.error(f"Error extracting content from {url}: {str(e)}", exc_info=True)
            raise

def extract_content(url: str) -> Dict:
    """Main function to extract and analyze content."""
    try:
        logger.info(f"Starting content extraction for {url}")
        extractor = ContentExtractor(url)
        result = asyncio.run(extractor.analyze_site_links(url))
        logger.info("Content extraction completed successfully")
        return result
    except Exception as e:
        logger.error(f"Error in content extraction: {str(e)}", exc_info=True)
        raise