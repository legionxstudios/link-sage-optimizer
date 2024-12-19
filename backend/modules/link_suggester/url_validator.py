import re
from urllib.parse import urlparse
import logging

logger = logging.getLogger(__name__)

def is_valid_webpage_url(url: str) -> bool:
    """
    Validate if a URL points to a webpage rather than a resource file.
    """
    try:
        parsed = urlparse(url)
        
        # Check protocol
        if parsed.scheme not in ['http', 'https']:
            return False
            
        # Get file extension if any
        path = parsed.path
        extension = path.split('.')[-1].lower() if '.' in path else ''
        
        # Valid webpage extensions
        valid_extensions = {'', 'html', 'htm', 'php', 'asp', 'aspx', 'jsp'}
        
        # Invalid extensions (files we don't want to process)
        invalid_extensions = {
            'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp',
            'pdf', 'doc', 'docx', 'xls', 'xlsx',
            'zip', 'rar', 'tar', 'gz',
            'mp3', 'mp4', 'avi', 'mov',
            'css', 'js', 'json'
        }
        
        # Check if extension is explicitly invalid
        if extension in invalid_extensions:
            logger.debug(f"Filtered out file with extension: {extension}")
            return False
            
        # If there's an extension, it must be in valid list
        if extension and extension not in valid_extensions:
            return False
            
        return True
        
    except Exception as e:
        logger.error(f"Error validating URL {url}: {str(e)}")
        return False