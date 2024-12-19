import logging
from typing import List, Dict

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
            
        # Check if the exact anchor text exists in content
        if anchor_text in content_lower:
            logger.info(f"Found valid suggestion: {anchor_text}")
            validated_suggestions.append(suggestion)
        else:
            logger.info(f"Filtered out non-existing suggestion: {anchor_text}")
            
    logger.info(f"Validated suggestions: {len(validated_suggestions)} of {len(suggestions)}")
    return validated_suggestions