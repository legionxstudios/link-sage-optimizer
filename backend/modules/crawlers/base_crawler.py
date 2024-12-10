import logging
from urllib.parse import urlparse
from typing import Dict, Set

logger = logging.getLogger(__name__)

class BaseCrawler:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.domain = urlparse(base_url).netloc
        self.visited_urls: Set[str] = set()
        
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