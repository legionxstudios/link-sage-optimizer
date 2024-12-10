from bs4 import BeautifulSoup
import logging
import re

logger = logging.getLogger(__name__)

def clean_content(text: str) -> str:
    """Clean extracted content."""
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)
    # Remove special characters but keep sentence structure
    text = re.sub(r'[^\w\s.,!?-]', '', text)
    return text.strip()

def extract_content(response_text: str) -> dict:
    """Extract meaningful content from HTML."""
    try:
        soup = BeautifulSoup(response_text, 'html.parser')
        
        # Remove script, style, nav, and other non-content elements
        for element in soup.find_all(['script', 'style', 'nav', 'header', 'footer', 'aside']):
            element.decompose()
        
        # Extract title
        title = soup.title.string if soup.title else ""
        
        # Try to find the main content area
        main_content = ""
        content_selectors = [
            'article',
            'main',
            '[role="main"]',
            '.post-content',
            '.entry-content',
            '.article-content',
            '.content',
            '#content'
        ]
        
        # Try each selector until we find content
        for selector in content_selectors:
            content_area = soup.select_one(selector)
            if content_area:
                # Extract all paragraphs from the content area
                paragraphs = []
                for p in content_area.find_all('p'):
                    text = p.get_text(strip=True)
                    if len(text) > 30:  # Only keep substantial paragraphs
                        paragraphs.append(text)
                
                if paragraphs:
                    main_content = ' '.join(paragraphs)
                    break
        
        # Fallback to all paragraphs if no content area found
        if not main_content:
            paragraphs = []
            for p in soup.find_all('p'):
                text = p.get_text(strip=True)
                if len(text) > 30:
                    paragraphs.append(text)
            main_content = ' '.join(paragraphs)
        
        # Clean the content
        main_content = clean_content(main_content)
        
        logger.info(f"Extracted content length: {len(main_content)} characters")
        logger.info(f"Title: {title}")
        
        return {
            'title': title,
            'content': main_content
        }
    except Exception as e:
        logger.error(f"Error extracting content: {str(e)}")
        raise