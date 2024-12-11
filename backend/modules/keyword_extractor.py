import logging
from typing import Dict, List
import nltk
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.corpus import stopwords
from nltk.tag import pos_tag
import httpx
import os
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

try:
    nltk.download('punkt')
    nltk.download('stopwords')
    nltk.download('averaged_perceptron_tagger')
except Exception as e:
    logger.error(f"Error downloading NLTK data: {e}")

async def validate_seo_keywords(phrases: List[str], content: str) -> Dict[str, float]:
    """Validate keyword phrases using HuggingFace API for SEO relevance."""
    try:
        logger.info(f"Starting SEO validation for {len(phrases)} phrases")
        logger.info(f"Sample phrases to validate: {phrases[:5]}")
        
        api_key = os.getenv('HUGGING_FACE_API_KEY')
        if not api_key:
            logger.error("No HuggingFace API key found!")
            return {}

        # Create content-based labels for better context
        content_snippet = content[:500]  # Use shorter snippet for more focused analysis
        logger.info(f"Using content snippet for context: {content_snippet[:100]}...")

        async with httpx.AsyncClient(timeout=30.0) as client:
            # First, analyze content theme
            theme_response = await client.post(
                "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "inputs": content_snippet,
                    "parameters": {
                        "candidate_labels": [
                            "photography tutorial",
                            "camera equipment",
                            "photo editing",
                            "photography business",
                            "photography techniques"
                        ]
                    }
                }
            )
            
            theme_result = theme_response.json()
            logger.info(f"Theme analysis response: {theme_result}")
            
            if "error" in theme_result:
                logger.error(f"Theme API error: {theme_result['error']}")
                return {}

            # Now validate each phrase in context
            validated_scores = {}
            for phrase in phrases:
                try:
                    response = await client.post(
                        "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
                        headers={"Authorization": f"Bearer {api_key}"},
                        json={
                            "inputs": f"Context: {content_snippet}\nKeyword: {phrase}",
                            "parameters": {
                                "candidate_labels": ["relevant seo keyword", "irrelevant phrase"],
                                "multi_label": False
                            }
                        }
                    )
                    
                    result = response.json()
                    logger.info(f"Validation result for '{phrase}': {result}")
                    
                    if "scores" in result and result["labels"][0] == "relevant seo keyword":
                        validated_scores[phrase] = result["scores"][0]
                    
                except Exception as e:
                    logger.error(f"Error validating phrase '{phrase}': {e}")
                    continue

            logger.info(f"Validation complete. Found {len(validated_scores)} relevant keywords")
            return validated_scores
            
    except Exception as e:
        logger.error(f"Error in SEO validation: {e}")
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
        
        # Extract potential SEO phrases
        seo_phrases = []
        
        for sentence in sentences:
            tokens = word_tokenize(sentence)
            pos_tags = pos_tag(tokens)
            
            # Look for 2-3 word phrases with specific patterns
            for i in range(len(pos_tags) - 2):
                # Two word phrases (noun phrases, verb phrases)
                if (pos_tags[i][1].startswith(('JJ', 'NN', 'VB')) and 
                    pos_tags[i+1][1].startswith('NN')):
                    
                    phrase = f"{pos_tags[i][0].lower()} {pos_tags[i+1][0].lower()}"
                    if not any(word in stop_words for word in phrase.split()):
                        seo_phrases.append(phrase)
                
                # Three word phrases (more complex patterns)
                if (i < len(pos_tags) - 2 and
                    pos_tags[i][1].startswith(('JJ', 'NN', 'VB')) and 
                    pos_tags[i+1][1].startswith(('JJ', 'NN')) and 
                    pos_tags[i+2][1].startswith('NN')):
                    
                    phrase = f"{pos_tags[i][0].lower()} {pos_tags[i+1][0].lower()} {pos_tags[i+2][0].lower()}"
                    if not any(word in stop_words for word in phrase.split()):
                        seo_phrases.append(phrase)
        
        logger.info(f"Extracted {len(seo_phrases)} potential SEO phrases")
        logger.info(f"Sample phrases before validation: {seo_phrases[:5]}")
        
        # Remove duplicates while preserving order
        unique_phrases = list(dict.fromkeys(seo_phrases))
        
        # Validate phrases with HuggingFace API
        seo_scores = await validate_seo_keywords(unique_phrases, content)
        logger.info(f"Received validation scores for {len(seo_scores)} phrases")
        
        # Sort phrases by SEO relevance score
        scored_phrases = [
            (phrase, seo_scores.get(phrase, 0))
            for phrase in unique_phrases
        ]
        scored_phrases.sort(key=lambda x: x[1], reverse=True)
        
        # Split into categories based on score thresholds
        exact_threshold = 0.8
        broad_threshold = 0.6
        
        exact_match = [phrase for phrase, score in scored_phrases if score >= exact_threshold]
        broad_match = [phrase for phrase, score in scored_phrases if exact_threshold > score >= broad_threshold]
        related_match = [phrase for phrase, score in scored_phrases if broad_threshold > score >= 0.4]
        
        logger.info(f"Final results:")
        logger.info(f"Exact match keywords ({len(exact_match)}): {exact_match[:5]}")
        logger.info(f"Broad match keywords ({len(broad_match)}): {broad_match[:5]}")
        logger.info(f"Related match keywords ({len(related_match)}): {related_match[:5]}")
        
        return {
            'exact_match': exact_match[:15],  # Top 15 exact matches
            'broad_match': broad_match[:15],  # Top 15 broad matches
            'related_match': related_match[:15]  # Top 15 related matches
        }
        
    except Exception as e:
        logger.error(f"Error extracting keywords: {e}")
        return {'exact_match': [], 'broad_match': [], 'related_match': []}