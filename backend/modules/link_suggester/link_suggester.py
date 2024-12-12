import logging
from typing import List, Dict, Any
from .openai_client import analyze_content_with_openai
from .suggestion_generator import generate_suggestions_from_phrases
from .relevance_calculator import calculate_relevance_score

logger = logging.getLogger(__name__)

async def generate_link_suggestions(
    content: str,
    keywords: Dict[str, List[str]],
    existing_links: List[Dict]
) -> Dict[str, List[Dict]]:
    """Generate link suggestions based on content analysis and find relevant target pages."""
    try:
        logger.info("Starting link suggestion generation")
        logger.info(f"Content length: {len(content)}")
        logger.info(f"Keywords: {keywords}")
        logger.info(f"Existing links count: {len(existing_links)}")
        
        # Get key phrases from OpenAI
        key_phrases = await analyze_content_with_openai(content)
        if not key_phrases:
            logger.warning("No key phrases generated")
            return {'outboundSuggestions': []}
            
        logger.info(f"Generated {len(key_phrases)} key phrases")
        
        # Generate suggestions based on key phrases
        suggestions = await generate_suggestions_from_phrases(key_phrases, content)
        
        # Sort by relevance score and limit to top suggestions
        suggestions.sort(key=lambda x: x['relevanceScore'], reverse=True)
        suggestions = suggestions[:10]
        
        logger.info(f"Generated {len(suggestions)} final suggestions")
        return {'outboundSuggestions': suggestions}
        
    except Exception as e:
        logger.error(f"Error generating suggestions: {str(e)}", exc_info=True)
        return {'outboundSuggestions': []}