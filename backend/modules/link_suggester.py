import logging
from typing import List, Dict, Any
import httpx
import os
from dotenv import load_dotenv
import json

load_dotenv()
logger = logging.getLogger(__name__)

async def analyze_content(content: str) -> Dict[str, Any]:
    """Analyze content using OpenAI function calling to extract key phrases."""
    try:
        logger.info("Starting content analysis with OpenAI function calling")
        
        function_definition = {
            "name": "extract_key_phrases",
            "description": "Extract 2-3 word key phrases related to the central topics from the provided webpage content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "key_phrases": {
                        "type": "array",
                        "items": {
                            "type": "string"
                        },
                        "description": "List of key phrases extracted from the text."
                    }
                },
                "required": ["key_phrases"]
            }
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are an expert at identifying key topics and phrases for SEO interlinking."
                    },
                    {
                        "role": "user",
                        "content": f"Extract 10 key phrases (each 2-3 words) that represent the main topics of the following content for SEO interlinking:\n\n{content[:2000]}"
                    }
                ],
                "functions": [function_definition],
                "function_call": {"name": "extract_key_phrases"}
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
                function_call = result['choices'][0]['message'].get('function_call')
                if not function_call:
                    logger.error("No function call in response")
                    return []
                    
                arguments = json.loads(function_call['arguments'])
                key_phrases = arguments.get('key_phrases', [])
                
                # Convert key phrases to link suggestions
                suggestions = []
                for phrase in key_phrases:
                    suggestions.append({
                        "suggestedAnchorText": phrase,
                        "context": f"Found key phrase: {phrase}",
                        "matchType": "keyword_based",
                        "relevanceScore": 0.8  # High confidence since these are main topics
                    })
                
                logger.info(f"Generated {len(suggestions)} suggestions from key phrases")
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
        
        logger.info(f"Generated {len(suggestions)} valid suggestions")
        return {'outboundSuggestions': suggestions[:10]}  # Limit to top 10
        
    except Exception as e:
        logger.error(f"Error generating suggestions: {str(e)}", exc_info=True)
        return {'outboundSuggestions': []}