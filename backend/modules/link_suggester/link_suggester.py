import logging
from typing import List, Dict, Any
import os
from dotenv import load_dotenv
import json
import openai
from .url_validator import is_valid_webpage_url

load_dotenv()
logger = logging.getLogger(__name__)

openai.api_key = os.getenv('OPENAI_API_KEY')

async def generate_link_suggestions(
    content: str,
    keywords: Dict[str, List[str]],
    existing_links: List[Dict]
) -> Dict[str, List[Dict]]:
    """Generate link suggestions based on content analysis and find relevant target pages."""
    try:
        logger.info("Starting link suggestion generation")
        
        # Get key phrases from OpenAI
        key_phrases = await analyze_content(content)
        if not key_phrases:
            logger.warning("No key phrases generated")
            return {'outboundSuggestions': []}
            
        logger.info(f"Generated {len(key_phrases)} key phrases")
        
        # Initialize Supabase client
        from supabase import create_client
        supabase = create_client(
            os.getenv('SUPABASE_URL', ''),
            os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
        )
        
        suggestions = []
        
        # For each key phrase, find relevant pages in our database
        for phrase in key_phrases:
            try:
                # Search for pages containing this phrase in title or content
                response = await supabase.table('pages').select('url, title, content') \
                    .or_(f"title.ilike.%{phrase}%,content.ilike.%{phrase}%") \
                    .limit(20) \
                    .execute()
                
                relevant_pages = [
                    page for page in response.data 
                    if is_valid_webpage_url(page['url'])
                ]
                
                logger.info(f"Found {len(relevant_pages)} relevant pages for phrase: {phrase}")
                
                # Find relevant context in the content
                phrase_context = find_phrase_context(content, phrase)
                
                # Create suggestions for each relevant page
                for page in relevant_pages:
                    suggestions.append({
                        "suggestedAnchorText": phrase,
                        "context": phrase_context,
                        "matchType": "keyword_based",
                        "relevanceScore": calculate_relevance_score(phrase, page),
                        "targetUrl": page['url'],
                        "targetTitle": page['title']
                    })
                    
            except Exception as e:
                logger.error(f"Error processing phrase {phrase}: {str(e)}")
                continue
        
        # Sort by relevance score and get top suggestions
        suggestions.sort(key=lambda x: x['relevanceScore'], reverse=True)
        suggestions = suggestions[:20]  # Increased from 10 to 20
        
        logger.info(f"Generated {len(suggestions)} final suggestions")
        return {'outboundSuggestions': suggestions}
        
    except Exception as e:
        logger.error(f"Error generating suggestions: {str(e)}", exc_info=True)
        return {'outboundSuggestions': []}

# ... keep existing code (helper functions for phrase context and relevance scoring)