from typing import Dict, List
import httpx
import json
import os
import logging
import asyncio
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

class RelevanceScorer:
    def __init__(self):
        self.api_key = os.getenv('OPENAI_API_KEY')
        self.max_retries = 3
        self.base_delay = 1  # seconds
        
        if not self.api_key:
            logger.error("No OpenAI API key found!")
    
    async def score_phrases(self, content: str, phrases: List[str]) -> Dict[str, float]:
        """Score phrases based on their relevance using OpenAI API with retry logic."""
        if not phrases:
            logger.warning("No phrases provided for scoring")
            return {}
            
        if not self.api_key:
            logger.error("Cannot score phrases: No OpenAI API key")
            return {}
        
        try:
            logger.info(f"Scoring {len(phrases)} phrases using OpenAI")
            
            for attempt in range(self.max_retries):
                try:
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        response = await client.post(
                            "https://api.openai.com/v1/chat/completions",
                            headers={
                                "Authorization": f"Bearer {self.api_key}",
                                "Content-Type": "application/json"
                            },
                            json={
                                "model": "gpt-4o-mini",
                                "messages": [
                                    {
                                        "role": "system",
                                        "content": """You are an SEO expert analyzing keyword relevance.
                                        Focus ONLY on 2-3 word phrases that represent:
                                        - Key topics and themes
                                        - Important concepts
                                        - Product/service descriptions
                                        - Industry terminology
                                        
                                        Return scores ONLY for 2-3 word phrases."""
                                    },
                                    {
                                        "role": "user",
                                        "content": f"""Content: {content[:1000]}\n\nPhrases to evaluate: {json.dumps(phrases)}
                                        
                                        Return a JSON object with phrases as keys and scores as values where:
                                        1.0 = Essential theme/topic
                                        0.8 = Important supporting concept
                                        0.6 = Relevant but secondary phrase
                                        0.4 or below = Not very relevant
                                        
                                        ONLY score 2-3 word phrases."""
                                    }
                                ]
                            }
                        )
                        
                    if response.status_code != 200:
                        logger.error(f"OpenAI API Error: {response.text}")
                        if attempt < self.max_retries - 1:
                            wait_time = self.base_delay * (2 ** attempt)
                            logger.info(f"Retrying in {wait_time} seconds...")
                            await asyncio.sleep(wait_time)
                            continue
                        return {}
                        
                    result = response.json()
                    scores = json.loads(result['choices'][0]['message']['content'])
                    logger.info(f"Successfully scored {len(scores)} phrases")
                    return scores
                    
                except Exception as e:
                    if attempt < self.max_retries - 1:
                        wait_time = self.base_delay * (2 ** attempt)
                        logger.warning(f"Attempt {attempt + 1} failed: {str(e)}. Retrying in {wait_time} seconds...")
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(f"All retry attempts failed: {str(e)}", exc_info=True)
                        return {}
                
        except Exception as e:
            logger.error(f"Error scoring phrases: {str(e)}", exc_info=True)
            return {}