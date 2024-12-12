import logging

logger = logging.getLogger(__name__)

def find_phrase_context(content: str, phrase: str, context_length: int = 100) -> str:
    """Find the surrounding context for a phrase in the content."""
    try:
        phrase_lower = phrase.lower()
        content_lower = content.lower()
        
        # Find the phrase position
        pos = content_lower.find(phrase_lower)
        if pos == -1:
            return ""
            
        # Get surrounding context
        start = max(0, pos - context_length)
        end = min(len(content), pos + len(phrase) + context_length)
        
        context = content[start:end].strip()
        # Highlight the phrase
        context = context.replace(phrase, f"[{phrase}]")
        
        return context
        
    except Exception as e:
        logger.error(f"Error finding context: {str(e)}")
        return ""