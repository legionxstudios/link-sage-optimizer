import logging
from typing import Dict, List
import nltk
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.corpus import stopwords
from nltk.tag import pos_tag
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

        logger.info("Starting OpenAI API request with key length: " + str(len(api_key)))
        
        # Get first few paragraphs for context
        content_summary = ". ".join(sent_tokenize(content)[:3])
        logger.info(f"Using content summary: {content_summary[:200]}...")

        async with httpx.AsyncClient(timeout=30.0) as client:
            logger.info("Making OpenAI API request...")
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
                            "content": """You are a photography SEO expert. Extract and score multi-word photography-related phrases (2-3 words) from the content.
                            Focus on:
                            - Photography techniques (e.g., 'long exposure', 'golden hour photography')
                            - Camera equipment (e.g., 'wide angle lens', 'tripod mount')
                            - Photography concepts (e.g., 'depth field', 'rule thirds')
                            - Photography services (e.g., 'wedding photography', 'portrait session')
                            
                            Only return multi-word phrases, no single words."""
                        },
                        {
                            "role": "user",
                            "content": f"""Content: {content_summary}\n\nPhrases to evaluate: {json.dumps(phrases)}
                            
                            For each multi-word phrase, return a relevance score between 0 and 1, where:
                            1.0 = Essential photography term or concept
                            0.8 = Important photography-related phrase
                            0.6 = Generally relevant to photography
                            0.4 or below = Not very relevant
                            
                            Return only a JSON object with multi-word phrases as keys and scores as values.
                            Ignore single-word terms completely."""
                        }
                    ]
                }
            )
            
            logger.info(f"OpenAI API Response Status: {response.status_code}")
            logger.info(f"OpenAI API Response Headers: {response.headers}")
            
            if response.status_code != 200:
                logger.error(f"OpenAI API Error Response: {response.text}")
                return {}

            result = response.json()
            logger.info("Received OpenAI response")
            logger.info(f"OpenAI response: {result}")

            try:
                # Extract the JSON from the response content
                content = result['choices'][0]['message']['content']
                scores = json.loads(content)
                logger.info(f"Processed scores for {len(scores)} phrases")
                return scores
            except Exception as e:
                logger.error(f"Error parsing OpenAI response: {e}")
                logger.error(f"Raw response content: {content}")
                return {}

    except Exception as e:
        logger.error(f"Error in content relevance analysis: {e}")
        logger.error(f"Full error details: {str(e)}")
        return {}

def extract_keywords(content: str) -> Dict[str, List[str]]:
    """Extract multi-word SEO keywords from content with different match types."""
    try:
        logger.info("Starting keyword extraction process")
        
        # Initialize NLTK resources
        stop_words = set(stopwords.words('english'))
        stop_words.update(['will', 'your', 'which', 'available'])
        
        # Pre-process content
        content = content.replace('-', ' ').replace('/', ' ').replace('_', ' ')
        sentences = sent_tokenize(content)
        logger.info(f"Processing {len(sentences)} sentences")
        
        # Extract potential phrases
        phrases = []
        
        for sentence in sentences:
            # Tokenize and get POS tags
            tokens = word_tokenize(sentence)
            pos_tags = pos_tag(tokens)
            
            # Extract phrases based on POS patterns
            for i in range(len(pos_tags) - 2):
                # Two-word phrases (noun phrases, technical terms)
                if (pos_tags[i][1].startswith(('JJ', 'NN', 'VB')) and 
                    pos_tags[i+1][1].startswith('NN')):
                    
                    phrase = f"{pos_tags[i][0].lower()} {pos_tags[i+1][0].lower()}"
                    if not any(word in stop_words for word in phrase.split()):
                        phrases.append(phrase)
                
                # Three-word phrases
                if (i < len(pos_tags) - 2 and
                    pos_tags[i][1].startswith(('JJ', 'NN', 'VB')) and 
                    pos_tags[i+1][1].startswith(('JJ', 'NN')) and 
                    pos_tags[i+2][1].startswith('NN')):
                    
                    phrase = f"{pos_tags[i][0].lower()} {pos_tags[i+1][0].lower()} {pos_tags[i+2][0].lower()}"
                    if not any(word in stop_words for word in phrase.split()):
                        phrases.append(phrase)
        
        # Remove duplicates while preserving order
        unique_phrases = list(dict.fromkeys(phrases))
        logger.info(f"Extracted {len(unique_phrases)} unique phrases")
        
        # Get relevance scores
        scores = await analyze_content_relevance(content, unique_phrases)
        logger.info(f"Received scores for {len(scores)} phrases")
        
        # Filter out single-word phrases and categorize remaining ones based on scores
        exact_match = []
        broad_match = []
        related_match = []
        
        for phrase, score in scores.items():
            # Only include multi-word phrases
            if len(phrase.split()) > 1:
                if score >= 0.8:
                    exact_match.append(phrase)
                elif score >= 0.6:
                    broad_match.append(phrase)
                elif score >= 0.4:
                    related_match.append(phrase)
        
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