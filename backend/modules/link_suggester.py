import logging
from typing import List, Dict, Any
import httpx
import os
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

async def analyze_content(content: str) -> Dict[str, Any]:
    """Analyze the full content using OpenAI API to generate link suggestions."""
    try:
        logger.info("Starting content analysis with OpenAI")
        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "system",
                        "content": """You are an expert at suggesting relevant outbound links for content. For the given content:
                        1. Identify 3-5 specific topics or concepts that would benefit from external references
                        2. For each topic, suggest:
                           - An anchor text (2-4 words)
                           - A brief context (the relevant sentence or phrase)
                           - A relevance score (0.0-1.0)
                        3. Format your response as a JSON array of suggestions, each with:
                           {
                             "suggestedAnchorText": "string",
                             "context": "string",
                             "matchType": "keyword_based",
                             "relevanceScore": number
                           }"""
                    },
                    {
                        "role": "user",
                        "content": f"Generate link suggestions for: {content[:2000]}"
                    }
                ]
            }
            
            logger.info("Sending request to OpenAI")
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {os.getenv('OPENAI_API_KEY')}"},
                json=payload
            )
            
            result = response.json()
            logger.info("Received response from OpenAI")
            
            if "error" in result:
                logger.error(f"OpenAI API error: {result['error']}")
                return []
                
            if not result.get('choices'):
                logger.error("No choices in OpenAI response")
                return []
                
            try:
                # The response should be a JSON string containing an array of suggestions
                suggestions = result['choices'][0]['message']['content']
                logger.info(f"Generated suggestions: {suggestions}")
                return suggestions
            except Exception as e:
                logger.error(f"Error parsing OpenAI response: {str(e)}")
                return []
            
    except Exception as e:
        logger.error(f"Error in content analysis: {str(e)}", exc_info=True)
        return []

async def generate_link_suggestions(
    content: str,
    keywords: Dict[str, List[str]],
    existing_links: List[Dict]
) -> Dict[str, List[Dict]]:
    """Generate link suggestions based on content analysis."""
    try:
        logger.info("Starting link suggestion generation")
        
        # Get suggestions from OpenAI
        suggestions = await analyze_content(content)
        
        if not suggestions:
            logger.warning("No suggestions generated")
            return {'outboundSuggestions': []}
            
        # Ensure we have valid suggestions
        if isinstance(suggestions, str):
            try:
                import json
                suggestions = json.loads(suggestions)
            except Exception as e:
                logger.error(f"Error parsing suggestions JSON: {str(e)}")
                return {'outboundSuggestions': []}
        
        # Validate and format suggestions
        formatted_suggestions = []
        for suggestion in suggestions:
            if isinstance(suggestion, dict):
                formatted_suggestion = {
                    'suggestedAnchorText': suggestion.get('suggestedAnchorText', ''),
                    'context': suggestion.get('context', ''),
                    'matchType': suggestion.get('matchType', 'keyword_based'),
                    'relevanceScore': float(suggestion.get('relevanceScore', 0.5))
                }
                if formatted_suggestion['suggestedAnchorText'] and formatted_suggestion['context']:
                    formatted_suggestions.append(formatted_suggestion)
        
        logger.info(f"Generated {len(formatted_suggestions)} valid suggestions")
        return {'outboundSuggestions': formatted_suggestions[:10]}  # Limit to top 10
        
    except Exception as e:
        logger.error(f"Error generating suggestions: {str(e)}", exc_info=True)
        return {'outboundSuggestions': []}