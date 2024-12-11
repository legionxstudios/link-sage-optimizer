import logging
from typing import Dict, List, Tuple
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.corpus import stopwords
from nltk.tag import pos_tag
from nltk.collocations import BigramCollocationFinder, TrigramCollocationFinder
from nltk.metrics import BigramAssocMeasures, TrigramAssocMeasures
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

def extract_phrases_with_pos(text: str) -> List[str]:
    """Extract meaningful 2-3 word phrases using POS patterns."""
    tokens = word_tokenize(text)
    pos_tags = pos_tag(tokens)
    phrases = []
    
    # Patterns for meaningful phrases (Adjective/Noun + Noun, etc.)
    for i in range(len(pos_tags) - 1):
        if (pos_tags[i][1].startswith(('JJ', 'NN', 'VB')) and 
            pos_tags[i+1][1].startswith('NN')):
            phrase = f"{pos_tags[i][0].lower()} {pos_tags[i+1][0].lower()}"
            phrases.append(phrase)
            
        if i < len(pos_tags) - 2:
            if (pos_tags[i][1].startswith(('JJ', 'NN')) and 
                pos_tags[i+1][1].startswith(('JJ', 'NN')) and 
                pos_tags[i+2][1].startswith('NN')):
                phrase = f"{pos_tags[i][0].lower()} {pos_tags[i+1][0].lower()} {pos_tags[i+2][0].lower()}"
                phrases.append(phrase)
    
    return phrases

def find_collocations(text: str) -> List[str]:
    """Find statistically significant phrases using collocation detection."""
    words = word_tokenize(text.lower())
    stop_words = set(stopwords.words('english'))
    words = [w for w in words if w.isalnum() and w not in stop_words]
    
    # Find bigrams
    bigram_finder = BigramCollocationFinder.from_words(words)
    bigram_measures = BigramAssocMeasures()
    bigrams = bigram_finder.nbest(bigram_measures.pmi, 20)
    
    # Find trigrams
    trigram_finder = TrigramCollocationFinder.from_words(words)
    trigram_measures = TrigramAssocMeasures()
    trigrams = trigram_finder.nbest(trigram_measures.pmi, 20)
    
    # Combine results
    phrases = [' '.join(bigram) for bigram in bigrams]
    phrases.extend([' '.join(trigram) for trigram in trigrams])
    
    return phrases

async def analyze_content_relevance(content: str, phrases: List[str]) -> Dict[str, float]:
    """Analyze content and phrases using OpenAI API for better phrase extraction."""
    try:
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            logger.error("No OpenAI API key found in environment!")
            return {}

        logger.info("Starting OpenAI API request")
        
        # Process content in chunks to handle longer texts
        content_chunks = sent_tokenize(content)
        chunk_size = 10  # Process 10 sentences at a time
        all_scores = {}
        
        for i in range(0, len(content_chunks), chunk_size):
            chunk = ". ".join(content_chunks[i:i + chunk_size])
            
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
                                "content": """You are an SEO expert analyzing keyword density.
                                Focus ONLY on meaningful 2-3 word phrases that represent:
                                - Key topics and themes
                                - Important concepts
                                - Product/service descriptions
                                - Industry terminology
                                
                                DO NOT return single-word phrases unless they are brand names or absolutely critical to the page theme."""
                            },
                            {
                                "role": "user",
                                "content": f"""Content chunk: {chunk}\n\nPhrases to evaluate: {json.dumps(phrases)}
                                
                                Return a JSON object with phrases as keys and scores as values where:
                                1.0 = Essential theme/topic of the page (must be 2-3 words)
                                0.8 = Important supporting concept (must be 2-3 words)
                                0.6 = Relevant but secondary phrase (must be 2-3 words)
                                0.4 or below = Not very relevant or single word
                                
                                ONLY include 2-3 word phrases unless a single word is a brand name or critically important."""
                            }
                        ]
                    }
                )
                
                if response.status_code != 200:
                    logger.error(f"OpenAI API Error: {response.text}")
                    continue

                result = response.json()
                chunk_scores = json.loads(result['choices'][0]['message']['content'])
                
                # Combine scores from different chunks
                for phrase, score in chunk_scores.items():
                    if phrase not in all_scores:
                        all_scores[phrase] = score
                    else:
                        all_scores[phrase] = max(all_scores[phrase], score)

        logger.info(f"Processed scores for {len(all_scores)} phrases")
        return all_scores

    except Exception as e:
        logger.error(f"Error in content relevance analysis: {e}")
        return {}

def calculate_keyword_density(content: str, phrases: List[str]) -> Dict[str, float]:
    """Calculate the density of each phrase in the content."""
    total_words = len(word_tokenize(content))
    densities = {}
    
    for phrase in phrases:
        phrase_words = phrase.split()
        if len(phrase_words) in [2, 3]:  # Only consider 2-3 word phrases
            count = content.lower().count(phrase.lower())
            # Normalize density by phrase length and total words
            density = (count * len(phrase_words)) / total_words if total_words > 0 else 0
            densities[phrase] = density
    
    return densities

def extract_keywords(content: str) -> Dict[str, List[str]]:
    """Extract meaningful 2-3 word phrases from content with keyword density analysis."""
    try:
        logger.info("Starting keyword density analysis")
        
        # Extract phrases using multiple methods
        pos_phrases = extract_phrases_with_pos(content)
        collocations = find_collocations(content)
        all_phrases = list(set(pos_phrases + collocations))
        
        # Calculate densities
        densities = calculate_keyword_density(content, all_phrases)
        
        # Get relevance scores
        scores = await analyze_content_relevance(content, all_phrases)
        
        # Combine density and relevance scores
        final_scores = {}
        for phrase in all_phrases:
            density = densities.get(phrase, 0)
            relevance = scores.get(phrase, 0)
            final_scores[phrase] = density * relevance
        
        # Sort phrases by final score
        sorted_phrases = sorted(
            final_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        # Filter and categorize phrases
        exact_match = []
        broad_match = []
        related_match = []
        
        for phrase, score in sorted_phrases:
            if len(phrase.split()) not in [2, 3]:
                continue
                
            if score >= 0.8:
                exact_match.append(f"{phrase} ({densities[phrase]:.2%})")
            elif score >= 0.6:
                broad_match.append(f"{phrase} ({densities[phrase]:.2%})")
            elif score >= 0.4:
                related_match.append(f"{phrase} ({densities[phrase]:.2%})")
        
        logger.info(f"Extracted keywords: exact={len(exact_match)}, broad={len(broad_match)}, related={len(related_match)}")
        
        return {
            'exact_match': exact_match[:15],
            'broad_match': broad_match[:15],
            'related_match': related_match[:15]
        }
        
    except Exception as e:
        logger.error(f"Error extracting keywords: {e}")
        return {'exact_match': [], 'broad_match': [], 'related_match': []}