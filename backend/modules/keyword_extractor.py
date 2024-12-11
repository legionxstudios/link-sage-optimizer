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
            logger.error("No OpenAI API key found!")
            return {}

        # Get first few paragraphs for context
        content_summary = ". ".join(sent_tokenize(content)[:3])
        logger.info(f"Using content summary: {content_summary[:200]}...")

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
                            "content": """You are a photography SEO expert. Analyze the content and phrases provided, 
                            and score each phrase based on its relevance to photography and SEO value. 
                            Focus on technical terms, equipment names, photography techniques, and industry terminology."""
                        },
                        {
                            "role": "user",
                            "content": f"""Content: {content_summary}\n\nPhrases to evaluate: {json.dumps(phrases)}
                            
                            For each phrase, return a relevance score between 0 and 1, where:
                            1.0 = Highly relevant photography term or concept
                            0.8 = Important photography-related phrase
                            0.6 = Generally relevant to photography
                            0.4 or below = Not very relevant
                            
                            Return only a JSON object with phrases as keys and scores as values."""
                        }
                    ]
                }
            )

            result = response.json()
            logger.info("Received OpenAI response")

            try:
                # Extract the JSON from the response content
                content = result['choices'][0]['message']['content']
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
        
        # Categorize phrases based on scores
        exact_match = []
        broad_match = []
        related_match = []
        
        for phrase, score in scores.items():
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