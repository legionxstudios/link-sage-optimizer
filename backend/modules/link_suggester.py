import logging
from typing import List, Dict, Any
import httpx
import os
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

async def generate_link_suggestions(
    content: str,
    keywords: Dict[str, List[str]],
    existing_links: List[Dict]
) -> Dict[str, List[Dict]]:
    """Generate outbound link suggestions based on content analysis."""
    try:
        suggestions = []
        existing_urls = {link.get('url', '') for link in existing_links}
        
        # Process each keyword type
        for match_type, kw_list in keywords.items():
            relevance_multiplier = {
                'exact_match': 1.0,
                'broad_match': 0.8,
                'related_match': 0.6
            }.get(match_type, 0.5)
            
            for keyword in kw_list:
                # Find sentences containing the keyword
                sentences = [s.strip() for s in content.split('.') 
                           if keyword.lower() in s.lower()]
                
                if not sentences:
                    continue
                
                try:
                    # Use Hugging Face for relevance validation
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        response = await client.post(
                            "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
                            headers={"Authorization": f"Bearer {os.getenv('HUGGING_FACE_API_KEY')}"},
                            json={
                                "inputs": sentences[0],
                                "parameters": {"candidate_labels": [keyword]},
                            }
                        )
                        
                        result = response.json()
                        scores = result.get("scores", [])
                        labels = result.get("labels", [])
                        
                        if scores and scores[0] > 0.3:  # Relevance threshold
                            suggestions.append({
                                'suggestedAnchorText': keyword,
                                'context': sentences[0],
                                'matchType': match_type,
                                'relevanceScore': scores[0] * relevance_multiplier
                            })
                            
                except Exception as e:
                    logger.error(f"Error processing keyword {keyword}: {e}")
                    continue
        
        # Sort by relevance score and return top suggestions
        suggestions.sort(key=lambda x: x['relevanceScore'], reverse=True)
        return {'outboundSuggestions': suggestions[:10]}
        
    except Exception as e:
        logger.error(f"Error generating suggestions: {e}")
        raise