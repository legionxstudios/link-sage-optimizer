from typing import Dict, List
import httpx
import json
import os
import logging
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

class RelevanceScorer:
    def __init__(self):
        self.api_key = os.getenv('OPENAI_API_KEY')
        if not self.api_key:
            logger.error("No OpenAI API key found!")
    
    async def score_phrases(self, content: str, phrases: List[str]) -> Dict[str, float]:
        """Score phrases based on their relevance using OpenAI API."""
        try:
            if not self.api_key:
                return {}
            
            logger.info("Scoring phrases using OpenAI")
            
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
                                "content": f"""Content: {content}\n\nPhrases to evaluate: {json.dumps(phrases)}
                                
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
                    return {}
                    
                result = response.json()
                scores = json.loads(result['choices'][0]['message']['content'])
                logger.info(f"Scored {len(scores)} phrases")
                return scores
                
        except Exception as e:
            logger.error(f"Error scoring phrases: {e}")
            return {}