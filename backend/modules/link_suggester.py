import logging
from typing import List, Dict, Any
import httpx
import os
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

async def find_keyword_contexts(content: str, keywords: List[str], is_outbound: bool = True) -> List[Dict[str, Any]]:
    """Find contexts where keywords appear and generate link suggestions."""
    try:
        logger.info(f"Starting keyword context analysis for {'outbound' if is_outbound else 'inbound'} links")
        logger.info(f"Processing {len(keywords)} keywords")
        
        suggestions = []
        
        # Process in smaller batches to avoid rate limits
        batch_size = 5
        for i in range(0, len(keywords), batch_size):
            batch_keywords = keywords[i:i + batch_size]
            logger.info(f"Processing batch {i//batch_size + 1} with {len(batch_keywords)} keywords")
            
            for keyword in batch_keywords:
                try:
                    # Find sentences containing the keyword
                    sentences = [s.strip() for s in content.split('.') if keyword.lower() in s.lower()]
                    
                    if not sentences:
                        continue
                        
                    logger.info(f"Found {len(sentences)} sentences containing keyword: {keyword}")
                    
                    # Use Hugging Face API with timeout and retry logic
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        for attempt in range(3):  # Try up to 3 times
                            try:
                                response = await client.post(
                                    "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
                                    headers={"Authorization": f"Bearer {os.getenv('HUGGING_FACE_API_KEY')}"},
                                    json={
                                        "inputs": sentences[0],
                                        "parameters": {"candidate_labels": [keyword]},
                                    },
                                    timeout=30.0
                                )
                                response.raise_for_status()
                                scores = response.json().get("scores", [])
                                
                                if scores and scores[0] > 0.3:  # Relevance threshold
                                    logger.info(f"Found relevant context for keyword {keyword} with score {scores[0]}")
                                    suggestions.append({
                                        "sourceUrl": "placeholder-source",
                                        "targetUrl": "placeholder-target",
                                        "suggestedAnchorText": keyword,
                                        "matchType": "Semantic Match",
                                        "relevanceScore": scores[0],
                                        "context": sentences[0]
                                    })
                                break  # Success, exit retry loop
                                
                            except httpx.TimeoutError:
                                logger.warning(f"Timeout on attempt {attempt + 1} for keyword {keyword}")
                                if attempt == 2:  # Last attempt
                                    logger.error(f"Failed all retries for keyword {keyword}")
                            except Exception as e:
                                logger.error(f"Error processing keyword {keyword}: {str(e)}")
                                break  # Don't retry on non-timeout errors
                                
                except Exception as e:
                    logger.error(f"Error processing keyword {keyword}: {str(e)}")
                    continue
            
            # Add a small delay between batches to respect rate limits
            await httpx.AsyncClient().aclose()
            
        logger.info(f"Generated {len(suggestions)} suggestions")
        return suggestions
        
    except Exception as e:
        logger.error(f"Error in find_keyword_contexts: {str(e)}")
        return []