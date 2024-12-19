import logging
from typing import List, Dict, Any
import os
import json
import openai
from .content_validator import validate_suggestions_against_content

logger = logging.getLogger(__name__)

async def generate_suggestions(content: str, keywords: Dict[str, List[str]], existing_links: List[Dict]) -> Dict[str, List[Dict]]:
    """Generate and validate link suggestions."""
    try:
        logger.info("Starting suggestion generation")
        
        # Get suggestions from OpenAI
        suggestions = await analyze_content(content)
        if not suggestions:
            return {'outboundSuggestions': []}
            
        # Validate suggestions exist in content
        validated_suggestions = validate_suggestions_against_content(content, suggestions)
        
        # Filter out any existing links
        final_suggestions = filter_existing_links(validated_suggestions, existing_links)
        
        logger.info(f"Generated {len(final_suggestions)} final suggestions")
        return {'outboundSuggestions': final_suggestions}
        
    except Exception as e:
        logger.error(f"Error generating suggestions: {str(e)}", exc_info=True)
        return {'outboundSuggestions': []}

def filter_existing_links(suggestions: List[Dict], existing_links: List[Dict]) -> List[Dict]:
    """Filter out suggestions that already exist as links."""
    existing_urls = {link.get('url', '').lower() for link in existing_links}
    existing_texts = {link.get('text', '').lower() for link in existing_links}
    
    return [
        suggestion for suggestion in suggestions
        if suggestion.get('targetUrl', '').lower() not in existing_urls
        and suggestion.get('suggestedAnchorText', '').lower() not in existing_texts
    ]

async def analyze_content(content: str) -> List[Dict]:
    """Analyze content using OpenAI to generate suggestions."""
    try:
        logger.info("Starting OpenAI content analysis")
        
        response = await openai.ChatCompletion.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are an SEO expert. Analyze the content and suggest ONLY phrases that actually appear in the content for internal linking. Return a JSON array of suggestions."
                },
                {
                    "role": "user",
                    "content": f"Analyze this content and suggest anchor text that EXISTS in the content:\n\n{content[:2000]}"
                }
            ],
            temperature=0.3,
            max_tokens=1000
        )
        
        if not response.choices:
            logger.error("No choices in OpenAI response")
            return []
            
        try:
            suggestions = json.loads(response.choices[0].message.content)
            if not isinstance(suggestions, list):
                logger.error("Invalid suggestions format")
                return []
                
            return suggestions
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse OpenAI response: {str(e)}")
            return []
            
    except Exception as e:
        logger.error(f"Error in content analysis: {str(e)}")
        return []