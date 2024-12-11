import logging
from typing import Dict, List
import nltk
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.corpus import stopwords
from nltk.tag import pos_tag
from collections import Counter
import httpx
import os
from dotenv import load_dotenv
import json

load_dotenv()
logger = logging.getLogger(__name__)

try:
    nltk.download('punkt')
    nltk.download('stopwords')
    nltk.download('averaged_perceptron_tagger')
except Exception as e:
    logger.error(f"Error downloading NLTK data: {e}")

async def analyze_content_relevance(content: str, phrases: List[str]) -> Dict[str, float]:
    """Analyze content and phrases using OpenAI API for better phrase extraction."""
    try:
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            logger.error("No OpenAI API key found in environment!")
            return {}

        logger.info("Starting OpenAI API request")
        content_summary = ". ".join(sent_tokenize(content)[:3])

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {
                            "role": "system",
                            "content": """You are an SEO expert. Analyze and score multi-word phrases (2-3 words) based on their relevance and frequency in the content.
                            Focus on meaningful phrases that represent:
                            - Key topics and themes
                            - Important concepts
                            - Product/service descriptions
                            - Industry terminology
                            
                            Only return phrases with 2-3 words unless a single word is critically important to the page theme."""
                        },
                        {
                            "role": "user",
                            "content": f"""Content: {content_summary}\n\nPhrases to evaluate: {json.dumps(phrases)}
                            
                            Return a JSON object with phrases as keys and scores as values where:
                            1.0 = Essential theme/topic of the page
                            0.8 = Important supporting concept
                            0.6 = Relevant but secondary phrase
                            0.4 or below = Not very relevant
                            
                            Only include meaningful multi-word phrases unless a single word is critically important."""
                        }
                    ]
                }
            )
            
            if response.status_code != 200:
                logger.error(f"OpenAI API Error: {response.text}")
                return {}

            result = response.json()
            content = result['choices'][0]['message']['content']
            try:
                scores = json.loads(content)
                logger.info(f"Processed scores for {len(scores)} phrases")
                return scores
            except Exception as e:
                logger.error(f"Error parsing OpenAI response: {e}")
                return {}

    except Exception as e:
        logger.error(f"Error in content relevance analysis: {e}")
        return {}

def extract_keywords(content: str) -> Dict[str, List[str]]:
    """Extract meaningful 2-3 word phrases from content with keyword density analysis."""
    try:
        logger.info("Starting keyword density analysis")
        
        # Initialize NLTK resources
        stop_words = set(stopwords.words('english'))
        stop_words.update(['will', 'your', 'which', 'available'])
        
        # Pre-process content
        content = content.replace('-', ' ').replace('/', ' ').replace('_', ' ')
        sentences = sent_tokenize(content)
        
        # Extract and count phrases
        phrase_counter = Counter()
        
        for sentence in sentences:
            tokens = word_tokenize(sentence)
            pos_tags = pos_tag(tokens)
            
            # Extract 2-word phrases
            for i in range(len(pos_tags) - 1):
                if (pos_tags[i][1].startswith(('JJ', 'NN', 'VB')) and 
                    pos_tags[i+1][1].startswith('NN')):
                    
                    phrase = f"{pos_tags[i][0].lower()} {pos_tags[i+1][0].lower()}"
                    if not any(word in stop_words for word in phrase.split()):
                        phrase_counter[phrase] += 1
            
            # Extract 3-word phrases
            for i in range(len(pos_tags) - 2):
                if (pos_tags[i][1].startswith(('JJ', 'NN', 'VB')) and 
                    pos_tags[i+1][1].startswith(('JJ', 'NN')) and 
                    pos_tags[i+2][1].startswith('NN')):
                    
                    phrase = f"{pos_tags[i][0].lower()} {pos_tags[i+1][0].lower()} {pos_tags[i+2][0].lower()}"
                    if not any(word in stop_words for word in phrase.split()):
                        phrase_counter[phrase] += 2  # Give slightly higher weight to 3-word phrases
        
        # Get most common phrases
        common_phrases = [phrase for phrase, count in phrase_counter.most_common(45)]
        logger.info(f"Extracted {len(common_phrases)} common phrases")
        
        # Get relevance scores
        scores = await analyze_content_relevance(content, common_phrases)
        
        # Categorize phrases based on frequency and relevance
        exact_match = []
        broad_match = []
        related_match = []
        
        for phrase, count in phrase_counter.most_common(45):
            relevance_score = scores.get(phrase, 0.4)
            if relevance_score >= 0.8:
                exact_match.append(f"{phrase} ({count})")
            elif relevance_score >= 0.6:
                broad_match.append(f"{phrase} ({count})")
            elif relevance_score >= 0.4:
                related_match.append(f"{phrase} ({count})")
        
        logger.info(f"Categorized keywords:")
        logger.info(f"Exact matches: {len(exact_match)}")
        logger.info(f"Broad matches: {len(broad_match)}")
        logger.info(f"Related matches: {len(related_match)}")
        
        return {
            'exact_match': exact_match[:15],
            'broad_match': broad_match[:15],
            'related_match': related_match[:15]
        }
        
    except Exception as e:
        logger.error(f"Error extracting keywords: {e}")
        return {'exact_match': [], 'broad_match': [], 'related_match': []}