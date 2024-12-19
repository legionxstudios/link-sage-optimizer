import logging
from typing import List, Dict
import re

logger = logging.getLogger(__name__)

def validate_suggestions_against_content(content: str, suggestions: List[Dict]) -> List[Dict]:
    """Filter suggestions to only include those that exist in the content."""
    logger.info(f"Validating {len(suggestions)} suggestions against content")
    
    validated_suggestions = []
    content_lower = content.lower()
    
    for suggestion in suggestions:
        anchor_text = suggestion.get('suggestedAnchorText', '').lower()
        if not anchor_text:
            continue
            
        # Exact match check
        if anchor_text in content_lower:
            # Additional validation: check if it's a complete phrase
            # This prevents matching partial words
            pattern = r'\b' + re.escape(anchor_text) + r'\b'
            if re.search(pattern, content_lower):
                logger.info(f"Found valid suggestion: {anchor_text}")
                
                # Find the actual context where this anchor appears
                context = find_actual_context(content, anchor_text)
                if context:
                    suggestion['context'] = context
                    validated_suggestions.append(suggestion)
            else:
                logger.info(f"Filtered out partial match: {anchor_text}")
        else:
            logger.info(f"Filtered out non-existing suggestion: {anchor_text}")
            
    logger.info(f"Validated suggestions: {len(validated_suggestions)} of {len(suggestions)}")
    return validated_suggestions

def find_actual_context(content: str, anchor_text: str, context_length: int = 100) -> str:
    """Find the actual context where the anchor text appears in the content."""
    try:
        # Find the position of the anchor text
        start_pos = content.lower().find(anchor_text.lower())
        if start_pos == -1:
            return ""
            
        # Get surrounding context
        context_start = max(0, start_pos - context_length)
        context_end = min(len(content), start_pos + len(anchor_text) + context_length)
        
        # Extract the context
        context = content[context_start:context_end].strip()
        
        # Highlight the anchor text in the context
        pattern = re.compile(re.escape(anchor_text), re.IGNORECASE)
        context = pattern.sub(f"[{anchor_text}]", context)
        
        return context
        
    except Exception as e:
        logger.error(f"Error finding context: {str(e)}")
        return ""