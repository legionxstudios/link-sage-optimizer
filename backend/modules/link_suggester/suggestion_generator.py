import logging
from typing import Dict, List
from .utils import find_phrase_context, calculate_relevance_score
from supabase import create_client
import os

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
        
        # Get key phrases from content analyzer
        key_phrases = await analyze_content(content)
        if not key_phrases:
            logger.warning("No key phrases generated")
            return {'outboundSuggestions': []}
            
        logger.info(f"Generated {len(key_phrases)} key phrases")
        
        # Initialize Supabase client
        supabase = create_client(
            os.getenv('SUPABASE_URL', ''),
            os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
        )
        
        suggestions = []
        
        # For each verified phrase, find relevant pages
        for phrase in key_phrases:
            try:
                # Search for pages containing this phrase
                response = await supabase.table('pages').select('url, title, content') \
                    .or_(f"title.ilike.%{phrase}%,content.ilike.%{phrase}%") \
                    .limit(3) \
                    .execute()
                
                relevant_pages = response.data
                logger.info(f"Found {len(relevant_pages)} relevant pages for phrase: {phrase}")
                
                # Find context where phrase appears
                phrase_context = find_phrase_context(content, phrase)
                
                # Create suggestions for relevant pages
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
        
        # Sort by relevance and limit suggestions
        suggestions.sort(key=lambda x: x['relevanceScore'], reverse=True)
        suggestions = suggestions[:10]
        
        logger.info(f"Generated {len(suggestions)} final suggestions")
        return {'outboundSuggestions': suggestions}
        
    except Exception as e:
        logger.error(f"Error generating suggestions: {str(e)}", exc_info=True)
        return {'outboundSuggestions': []}