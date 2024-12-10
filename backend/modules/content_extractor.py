from bs4 import BeautifulSoup
import logging

logger = logging.getLogger(__name__)

def extract_content(response_text: str) -> dict:
    """Extract meaningful content from HTML."""
    try:
        soup = BeautifulSoup(response_text, 'html.parser')
        
        # Remove navigation, header, footer, and other non-content elements
        for element in soup.find_all(['nav', 'header', 'footer', 'aside', 'script', 'style']):
            element.decompose()
        
        # Extract title
        title = soup.title.string if soup.title else ""
        
        # Extract main content focusing on article content
        main_content = ""
        content_tags = soup.find_all(['article', 'main', 'div'], class_=['content', 'main-content', 'post-content', 'entry-content'])
        
        if content_tags:
            main_content = " ".join([tag.get_text(strip=True) for tag in content_tags])
        else:
            # Fallback to paragraph text if no main content areas found
            paragraphs = []
            for p in soup.find_all('p'):
                text = p.get_text(strip=True)
                if len(text) > 50:  # Filter out short paragraphs
                    paragraphs.append(text)
            main_content = " ".join(paragraphs)
        
        return {
            'title': title,
            'content': main_content
        }
    except Exception as e:
        logger.error(f"Error extracting content: {str(e)}")
        raise