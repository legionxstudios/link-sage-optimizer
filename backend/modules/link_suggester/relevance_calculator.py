import logging
from typing import Dict

logger = logging.getLogger(__name__)

def calculate_relevance_score(phrase: str, page: Dict) -> float:
    """Calculate relevance score based on phrase presence in title and content."""
    try:
        score = 0.0
        phrase_lower = phrase.lower()
        
        # Check title
        if page.get('title'):
            if phrase_lower in page['title'].lower():
                score += 0.5
                
        # Check content
        if page.get('content'):
            content_lower = page['content'].lower()
            if phrase_lower in content_lower:
                # Calculate frequency
                frequency = content_lower.count(phrase_lower)
                score += min(0.5, frequency * 0.1)  # Cap at 0.5
                
        return min(1.0, score)  # Ensure score doesn't exceed 1.0
        
    except Exception as e:
        logger.error(f"Error calculating relevance: {str(e)}")
        return 0.0