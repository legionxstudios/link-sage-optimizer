import logging
import os
import json
import openai
from typing import List, Dict

logger = logging.getLogger(__name__)

async def analyze_content_with_openai(content: str) -> List[Dict]:
    """Analyze content using OpenAI to generate suggestions."""
    try:
        logger.info("Starting OpenAI content analysis")
        
        # Prepare system message with clear instructions
        system_message = """You are an SEO expert. Analyze the content and suggest ONLY phrases that EXACTLY appear in the content for internal linking.
        Important rules:
        1. ONLY suggest anchor text that EXISTS VERBATIM in the content
        2. Each suggestion must be a complete phrase (2-5 words)
        3. Provide at least 15-20 suggestions if possible
        4. Do not suggest single words
        5. Verify each suggestion appears exactly as written in the content
        """
        
        response = await openai.ChatCompletion.acreate(
            model="gpt-4o",  # Using more capable model for better accuracy
            messages=[
                {
                    "role": "system",
                    "content": system_message
                },
                {
                    "role": "user",
                    "content": f"Analyze this content and suggest ONLY phrases that appear EXACTLY in the content:\n\n{content[:4000]}"
                }
            ],
            temperature=0.3,
            max_tokens=1500
        )
        
        if not response.choices:
            logger.error("No choices in OpenAI response")
            return []
            
        try:
            suggestions_text = response.choices[0].message.content
            suggestions = []
            
            # Parse the response and create suggestion objects
            lines = suggestions_text.strip().split('\n')
            for line in lines:
                line = line.strip()
                if not line or line.startswith('#') or line.startswith('-'):
                    continue
                    
                # Create suggestion object
                suggestion = {
                    "suggestedAnchorText": line,
                    "context": "",  # Will be filled by content validator
                    "matchType": "keyword_based",
                    "relevanceScore": 0.9  # Default score, will be adjusted
                }
                suggestions.append(suggestion)
            
            logger.info(f"Generated {len(suggestions)} initial suggestions")
            return suggestions
            
        except Exception as e:
            logger.error(f"Error parsing OpenAI response: {str(e)}")
            return []
            
    except Exception as e:
        logger.error(f"Error in content analysis: {str(e)}")
        return []