import logging
import os
from typing import List, Dict
from .context_extractor import find_phrase_context
from .relevance_calculator import calculate_relevance_score

logger = logging.getLogger(__name__)

async def generate_suggestions_from_phrases(
    key_phrases: List[str],
    content: str
) -> List[Dict]:
    """Generate link suggestions based on key phrases."""
    try:
        logger.info(f"Generating suggestions for {len(key_phrases)} phrases")
        
        # Initialize Supabase client
        from supabase import create_client
        supabase = create_client(
            os.getenv('SUPABASE_URL', ''),
            os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
        )
        
        suggestions = []
        
        # For each key phrase, find relevant pages
        for phrase in key_phrases:
            try:
                # Search for pages containing this phrase
                response = await supabase.table('pages').select('url, title, content') \
                    .or_(f"title.ilike.%{phrase}%,content.ilike.%{phrase}%") \
                    .limit(3) \
                    .execute()
                
                relevant_pages = response.data
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
                
        return suggestions
        
    except Exception as e:
        logger.error(f"Error generating suggestions: {str(e)}")
        return []