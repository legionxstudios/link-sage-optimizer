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

async def analyze_content_relevance(content: str, phrases: List[str]) -> Dict[str, float]:
    """Analyze content and phrases in a single batch request."""
    try:
        api_key = os.getenv('HUGGING_FACE_API_KEY')
        if not api_key:
            logger.error("No HuggingFace API key found!")
            return {}

        # Prepare content summary for context (first paragraph or two)
        content_summary = ". ".join(sent_tokenize(content)[:3])
        logger.info(f"Using content summary: {content_summary[:200]}...")

        # Photography-specific categories for classification
        categories = [
            "photography equipment",
            "photography technique",
            "photo editing",
            "camera settings",
            "photography tutorial",
            "photography business",
            "irrelevant"
        ]

        async with httpx.AsyncClient(timeout=30.0) as client:
            # Single batch request for all phrases
            inputs = [
                f"Content about photography: {content_summary}\nPhrase to evaluate: {phrase}"
                for phrase in phrases
            ]
            
            logger.info(f"Making batch request for {len(phrases)} phrases")
            
            response = await client.post(
                "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "inputs": inputs,
                    "parameters": {
                        "candidate_labels": categories,
                        "multi_label": False
                    }
                }
            )

            results = response.json()
            logger.info(f"Received batch results: {results[:2]}...")  # Log first two results

            # Process results and assign scores
            scores = {}
            for phrase, result in zip(phrases, results):
                try:
                    # Skip if the top category is "irrelevant"
                    if result["labels"][0] != "irrelevant":
                        # Weight score based on photography relevance
                        scores[phrase] = result["scores"][0]
                        logger.info(f"Phrase '{phrase}' scored {scores[phrase]} for category {result['labels'][0]}")
                except Exception as e:
                    logger.error(f"Error processing result for '{phrase}': {e}")
                    continue

            return scores

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
        
        # Extract potential SEO phrases
        seo_phrases = []
        
        for sentence in sentences:
            tokens = word_tokenize(sentence)
            pos_tags = pos_tag(tokens)
            
            # Look for noun phrases and technical terms
            for i in range(len(pos_tags) - 1):
                # Two word phrases (noun phrases, technical terms)
                if (pos_tags[i][1].startswith(('JJ', 'NN', 'VB')) and 
                    pos_tags[i+1][1].startswith('NN')):
                    
                    phrase = f"{pos_tags[i][0].lower()} {pos_tags[i+1][0].lower()}"
                    if not any(word in stop_words for word in phrase.split()):
                        seo_phrases.append(phrase)
                
                # Three word phrases (more specific terms)
                if (i < len(pos_tags) - 2 and
                    pos_tags[i][1].startswith(('JJ', 'NN')) and 
                    pos_tags[i+1][1].startswith('NN') and 
                    pos_tags[i+2][1].startswith('NN')):
                    
                    phrase = f"{pos_tags[i][0].lower()} {pos_tags[i+1][0].lower()} {pos_tags[i+2][0].lower()}"
                    if not any(word in stop_words for word in phrase.split()):
                        seo_phrases.append(phrase)
        
        # Remove duplicates while preserving order
        unique_phrases = list(dict.fromkeys(seo_phrases))
        logger.info(f"Extracted {len(unique_phrases)} unique phrases")
        
        # Get relevance scores for all phrases in one batch
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