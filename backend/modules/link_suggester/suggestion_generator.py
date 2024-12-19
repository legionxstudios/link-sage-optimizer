import logging
from typing import Dict, List
from .utils import find_phrase_context, calculate_relevance_score
from supabase import create_client
import os
import re

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
        
        # Combine all keywords into a single list for processing
        all_keywords = []
        for keyword_list in keywords.values():
            all_keywords.extend([kw.split('(')[0].strip() for kw in keyword_list])  # Remove density info
            
        logger.info(f"Processing {len(all_keywords)} potential keywords")
        
        # Initialize Supabase client
        supabase = create_client(
            os.getenv('SUPABASE_URL', ''),
            os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
        )
        
        suggestions = []
        content_lower = content.lower()
        
        # For each keyword, verify it exists in content and find its exact context
        for keyword in all_keywords:
            keyword = keyword.strip()
            if not keyword:
                continue
                
            # Create pattern with word boundaries
            pattern = r'\b' + re.escape(keyword.lower()) + r'\b'
            
            # Check if keyword exists in content with word boundaries
            if not re.search(pattern, content_lower):
                logger.info(f"Keyword not found in content: {keyword}")
                continue
                
            try:
                # Find the exact context where this keyword appears
                exact_context = find_exact_context(content, keyword)
                if not exact_context:
                    logger.warning(f"Could not find exact context for keyword: {keyword}")
                    continue
                    
                # Search for relevant pages containing this keyword
                response = await supabase.table('pages').select('url, title, content') \
                    .textSearch('content', keyword) \
                    .limit(3) \
                    .execute()
                    
                relevant_pages = response.data
                logger.info(f"Found {len(relevant_pages)} relevant pages for keyword: {keyword}")
                
                # Create suggestions for relevant pages
                for page in relevant_pages:
                    if not page.get('url'):
                        continue
                        
                    suggestions.append({
                        "suggestedAnchorText": keyword,
                        "context": exact_context,
                        "matchType": "keyword_based",
                        "relevanceScore": calculate_relevance_score(keyword, page),
                        "targetUrl": page['url'],
                        "targetTitle": page.get('title', '')
                    })
                    
            except Exception as e:
                logger.error(f"Error processing keyword {keyword}: {str(e)}")
                continue
        
        # Sort by relevance and limit suggestions
        suggestions.sort(key=lambda x: x['relevanceScore'], reverse=True)
        suggestions = suggestions[:10]
        
        logger.info(f"Generated {len(suggestions)} final suggestions")
        return {'outboundSuggestions': suggestions}
        
    except Exception as e:
        logger.error(f"Error generating suggestions: {str(e)}", exc_info=True)
        return {'outboundSuggestions': []}

def find_exact_context(content: str, keyword: str, context_length: int = 100) -> str:
    """Find the exact context where a keyword appears in the content."""
    try:
        content_lower = content.lower()
        keyword_lower = keyword.lower()
        
        # Find the position of the keyword with word boundaries
        pattern = r'\b' + re.escape(keyword_lower) + r'\b'
        match = re.search(pattern, content_lower)
        
        if not match:
            return ""
            
        start_pos = match.start()
        end_pos = match.end()
        
        # Get surrounding context
        context_start = max(0, start_pos - context_length)
        context_end = min(len(content), end_pos + context_length)
        
        # Get the exact case from the original content
        original_keyword = content[start_pos:end_pos]
        context = content[context_start:context_end].strip()
        
        # Highlight the keyword while preserving its original case
        highlighted_context = context.replace(original_keyword, f"[{original_keyword}]")
        
        return highlighted_context
        
    except Exception as e:
        logger.error(f"Error finding exact context: {str(e)}")
        return ""