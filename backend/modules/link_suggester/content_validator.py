import logging
from typing import List, Dict
import re

logger = logging.getLogger(__name__)

def validate_suggestions_against_content(content: str, suggestions: List[Dict]) -> List[Dict]:
    """Filter suggestions to only include those that exist exactly in the content."""
    logger.info(f"Validating {len(suggestions)} suggestions against content")
    
    validated_suggestions = []
    
    for suggestion in suggestions:
        anchor_text = suggestion.get('suggestedAnchorText', '')
        if not anchor_text:
            continue
            
        # Create pattern with word boundaries
        pattern = r'\b' + re.escape(anchor_text) + r'\b'
        match = re.search(pattern, content)
        
        if match:
            # Get the exact phrase as it appears in the content
            exact_phrase = content[match.start():match.end()]
            logger.info(f"Found exact match: '{exact_phrase}'")
            
            # Find the actual context where this anchor appears
            context = find_actual_context(content, exact_phrase)
            if context:
                suggestion['suggestedAnchorText'] = exact_phrase  # Use the exact phrase from content
                suggestion['context'] = context
                validated_suggestions.append(suggestion)
                logger.info(f"Validated suggestion: {exact_phrase} with context")
        else:
            logger.info(f"Filtered out non-exact match: {anchor_text}")
            
    logger.info(f"Validated {len(validated_suggestions)} suggestions")
    return validated_suggestions

def find_actual_context(content: str, exact_phrase: str, context_length: int = 100) -> str:
    """Find the actual context where the exact phrase appears in the content."""
    try:
        # Find the position of the exact phrase
        pattern = r'\b' + re.escape(exact_phrase) + r'\b'
        match = re.search(pattern, content)
        
        if not match:
            return ""
            
        start_pos = match.start()
        end_pos = match.end()
        
        # Get surrounding context
        context_start = max(0, start_pos - context_length)
        context_end = min(len(content), end_pos + context_length)
        
        # Extract the context with the exact phrase
        context = content[context_start:context_end].strip()
        
        # Highlight the exact phrase in the context
        highlighted_context = context.replace(exact_phrase, f"[{exact_phrase}]")
        
        logger.info(f"Found context for phrase '{exact_phrase}': {highlighted_context}")
        return highlighted_context
        
    except Exception as e:
        logger.error(f"Error finding context: {str(e)}")
        return ""