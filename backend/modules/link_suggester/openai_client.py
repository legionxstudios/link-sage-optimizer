import logging
import os
import json
import openai
from typing import List, Dict
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)

def similar(a: str, b: str) -> float:
    """Calculate string similarity ratio"""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

def extract_slug_keywords(url: str) -> List[str]:
    """Extract keywords from URL slug"""
    try:
        # Get the last part of the URL path
        slug = url.rstrip('/').split('/')[-1]
        # Split by common separators and filter empty strings
        keywords = [k for k in slug.replace('-', ' ').replace('_', ' ').split() if k]
        logger.info(f"Extracted slug keywords: {keywords} from URL: {url}")
        return keywords
    except Exception as e:
        logger.error(f"Error extracting slug keywords: {str(e)}")
        return []

async def analyze_content_with_openai(content: str, url: str) -> List[Dict]:
    """Analyze content using OpenAI to generate suggestions."""
    try:
        logger.info("Starting OpenAI content analysis")
        logger.info(f"Analyzing URL: {url}")
        
        # Extract keywords from the URL slug
        slug_keywords = extract_slug_keywords(url)
        logger.info(f"URL keywords: {slug_keywords}")
        
        # Prepare system message with clear instructions
        system_message = f"""You are an SEO expert. Analyze the content and suggest phrases for internal linking.
        The URL contains these keywords: {', '.join(slug_keywords)}
        
        Important rules:
        1. ONLY suggest anchor text that EXISTS VERBATIM in the content
        2. Each suggestion must be a complete phrase (2-5 words)
        3. Prioritize phrases that are semantically related to: {', '.join(slug_keywords)}
        4. Return ONLY valid JSON array of strings
        5. Verify each suggestion appears exactly in the content
        6. Focus on topic relevance to the URL keywords
        """
        
        response = await openai.ChatCompletion.acreate(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": system_message
                },
                {
                    "role": "user",
                    "content": f"Extract phrases that match these topics: {', '.join(slug_keywords)}\n\nContent:\n{content[:4000]}"
                }
            ],
            temperature=0.3,
            max_tokens=1500
        )
        
        if not response.choices:
            logger.error("No choices in OpenAI response")
            return []
            
        try:
            suggestions_text = response.choices[0].message.content.strip()
            logger.info(f"Raw OpenAI response: {suggestions_text}")
            
            # Clean the response to ensure valid JSON
            cleaned_text = suggestions_text.strip()
            if cleaned_text.startswith('```json'):
                cleaned_text = cleaned_text[7:-3] if cleaned_text.endswith('```') else cleaned_text[7:]
            
            phrases = json.loads(cleaned_text)
            
            if not isinstance(phrases, list):
                logger.error(f"Invalid response format, expected list but got: {type(phrases)}")
                return []
            
            suggestions = []
            for phrase in phrases:
                if not isinstance(phrase, str):
                    continue
                    
                # Calculate relevance based on similarity to slug keywords
                max_relevance = max(similar(phrase, kw) for kw in slug_keywords) if slug_keywords else 0.5
                
                suggestion = {
                    "suggestedAnchorText": phrase,
                    "context": "",  # Will be filled later
                    "matchType": "keyword_based",
                    "relevanceScore": max_relevance
                }
                suggestions.append(suggestion)
            
            logger.info(f"Generated {len(suggestions)} suggestions with slug matching")
            return suggestions
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error: {str(e)}")
            logger.error(f"Raw content causing error: {suggestions_text}")
            return []
            
    except Exception as e:
        logger.error(f"Error in content analysis: {str(e)}")
        return []