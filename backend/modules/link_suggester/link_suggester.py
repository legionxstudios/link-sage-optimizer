import logging
from typing import List, Dict, Any
import os
from dotenv import load_dotenv
import json
import openai
from .url_validator import is_valid_webpage_url
from .openai_client import analyze_content_with_openai
from difflib import SequenceMatcher

load_dotenv()
logger = logging.getLogger(__name__)

openai.api_key = os.getenv('OPENAI_API_KEY')

def calculate_url_similarity(url1: str, url2: str) -> float:
    """Calculate similarity between two URLs based on their slugs"""
    try:
        slug1 = url1.rstrip('/').split('/')[-1]
        slug2 = url2.rstrip('/').split('/')[-1]
        return SequenceMatcher(None, slug1, slug2).ratio()
    except:
        return 0

async def generate_link_suggestions(
    content: str,
    keywords: Dict[str, List[str]],
    existing_links: List[Dict],
    url: str
) -> Dict[str, List[Dict]]:
    """Generate link suggestions based on content analysis and find relevant target pages."""
    try:
        logger.info("Starting link suggestion generation")
        logger.info(f"Processing URL: {url}")
        
        # Get key phrases from OpenAI with URL context
        key_phrases = await analyze_content_with_openai(content, url)
        if not key_phrases:
            logger.warning("No key phrases generated")
            return {'outboundSuggestions': []}  # Return empty array instead of empty object
            
        logger.info(f"Generated {len(key_phrases)} key phrases")
        
        # Initialize Supabase client
        from supabase import create_client
        supabase = create_client(
            os.getenv('SUPABASE_URL', ''),
            os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
        )
        
        suggestions = []
        
        # For each key phrase, find relevant pages in our database
        for phrase_data in key_phrases:
            try:
                phrase = phrase_data['suggestedAnchorText']
                base_relevance = phrase_data.get('relevanceScore', 0.5)
                
                # Search for pages containing this phrase
                response = await supabase.table('pages').select('url, title, content').execute()
                
                relevant_pages = [
                    page for page in response.data 
                    if is_valid_webpage_url(page['url']) and page['url'] != url
                ]
                
                logger.info(f"Found {len(relevant_pages)} potential pages for phrase: {phrase}")
                
                # Find relevant context in the content
                from .context_extractor import find_phrase_context
                phrase_context = find_phrase_context(content, phrase)
                
                # Create suggestions for each relevant page
                for page in relevant_pages:
                    # Calculate combined relevance score
                    url_similarity = calculate_url_similarity(url, page['url'])
                    combined_score = (base_relevance + url_similarity) / 2
                    
                    if combined_score >= 0.3:  # Lowered threshold
                        suggestions.append({
                            "suggestedAnchorText": phrase,
                            "context": phrase_context,
                            "matchType": "keyword_based",
                            "relevanceScore": combined_score,
                            "targetUrl": page['url'],
                            "targetTitle": page['title']
                        })
                        logger.info(f"Added suggestion: {phrase} -> {page['url']} (score: {combined_score})")
                    
            except Exception as e:
                logger.error(f"Error processing phrase {phrase}: {str(e)}")
                continue
        
        # Sort by relevance score and get top suggestions
        suggestions.sort(key=lambda x: x['relevanceScore'], reverse=True)
        suggestions = suggestions[:20]
        
        logger.info(f"Generated {len(suggestions)} final suggestions")
        return {'outboundSuggestions': suggestions}  # Always return array, even if empty
        
    except Exception as e:
        logger.error(f"Error generating suggestions: {str(e)}", exc_info=True)
        return {'outboundSuggestions': []}  # Return empty array on error