import logging
import re

logger = logging.getLogger(__name__)

def find_phrase_context(content: str, phrase: str, context_length: int = 100) -> str:
    """Find the exact context where a phrase appears in the content."""
    try:
        content_lower = content.lower()
        phrase_lower = phrase.lower()
        
        # Find the position of the phrase with word boundaries
        pattern = r'\b' + re.escape(phrase_lower) + r'\b'
        match = re.search(pattern, content_lower)
        
        if not match:
            logger.warning(f"Phrase not found in content: {phrase}")
            return ""
            
        start_pos = match.start()
        end_pos = match.end()
        
        # Get surrounding context
        context_start = max(0, start_pos - context_length)
        context_end = min(len(content), end_pos + context_length)
        
        # Get the exact case from the original content
        original_phrase = content[start_pos:end_pos]
        context = content[context_start:context_end].strip()
        
        # Highlight the phrase while preserving its original case
        highlighted_context = context.replace(original_phrase, f"[{original_phrase}]")
        
        logger.info(f"Found context for phrase: {phrase}")
        logger.debug(f"Context: {highlighted_context}")
        
        return highlighted_context
        
    except Exception as e:
        logger.error(f"Error finding context: {str(e)}")
        return ""