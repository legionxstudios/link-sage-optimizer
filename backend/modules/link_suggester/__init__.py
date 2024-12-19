from .content_validator import validate_suggestions_against_content
from .suggestion_generator import generate_suggestions
from .openai_client import analyze_content_with_openai

async def generate_link_suggestions(content: str, keywords: dict, existing_links: list) -> dict:
    """Main entry point for generating link suggestions."""
    try:
        # Get suggestions from OpenAI
        suggestions = await analyze_content_with_openai(content)
        if not suggestions:
            return {'outboundSuggestions': []}
            
        # Validate suggestions exist in content
        validated_suggestions = validate_suggestions_against_content(content, suggestions)
        
        # Sort by relevance score and get top suggestions
        validated_suggestions.sort(key=lambda x: x['relevanceScore'], reverse=True)
        
        return {'outboundSuggestions': validated_suggestions[:15]}  # Increased from 10 to 15
        
    except Exception as e:
        logger.error(f"Error generating suggestions: {str(e)}", exc_info=True)
        return {'outboundSuggestions': []}