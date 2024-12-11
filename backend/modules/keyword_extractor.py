import logging
from typing import Dict, List
import nltk
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.corpus import stopwords
from nltk.tag import pos_tag

logger = logging.getLogger(__name__)

try:
    nltk.download('punkt')
    nltk.download('stopwords')
    nltk.download('averaged_perceptron_tagger')
except Exception as e:
    logger.error(f"Error downloading NLTK data: {e}")

def extract_keywords(content: str) -> Dict[str, List[str]]:
    """Extract keywords from content with different match types."""
    try:
        # Initialize NLTK resources
        stop_words = set(stopwords.words('english'))
        # Add common words that shouldn't be keywords
        stop_words.update(['will', 'your', 'which', 'available'])
        
        # Pre-process content
        # Replace common separators with spaces to avoid incorrect word joining
        content = content.replace('-', ' ').replace('/', ' ').replace('_', ' ')
        sentences = sent_tokenize(content)
        
        # Extract and score keyword phrases
        keywords = []
        for sentence in sentences:
            tokens = word_tokenize(sentence)
            pos_tags = pos_tag(tokens)
            
            # Look for noun phrases (1-3 words)
            for i in range(len(pos_tags)):
                if pos_tags[i][1].startswith('NN'):  # If it's a noun
                    # Single word
                    word = pos_tags[i][0].lower()
                    if word not in stop_words and len(word) > 3:
                        keywords.append(word)
                    
                    # Two word phrase
                    if i > 0 and pos_tags[i-1][1] in ['JJ', 'NN', 'NNP']:
                        prev_word = pos_tags[i-1][0].lower()
                        if prev_word not in stop_words:
                            keywords.append(f"{prev_word} {word}")
                    
                    # Three word phrase
                    if i > 1 and all(tag[1] in ['JJ', 'NN', 'NNP'] for tag in pos_tags[i-2:i]):
                        prev_words = f"{pos_tags[i-2][0].lower()} {pos_tags[i-1][0].lower()}"
                        if not any(w in stop_words for w in prev_words.split()):
                            keywords.append(f"{prev_words} {word}")
        
        # Filter and score keywords
        photography_related = [
            'photography', 'portrait', 'photo', 'session', 'studio',
            'photographer', 'shoot', 'camera', 'wedding', 'family',
            'professional', 'portrait session', 'photo shoot',
            'wedding photography', 'family portraits'
        ]
        
        # Score keywords based on relevance to photography
        keyword_scores = {}
        for keyword in keywords:
            score = keywords.count(keyword)
            # Boost score for photography-related terms
            if any(term in keyword.lower() for term in photography_related):
                score *= 1.5
            # Boost score for phrases
            if ' ' in keyword:
                score *= 1.2
            keyword_scores[keyword] = score
        
        # Sort keywords by score
        sorted_keywords = sorted(keyword_scores.items(), key=lambda x: x[1], reverse=True)
        
        # Split into categories (70-20-10 distribution)
        total = len(sorted_keywords)
        exact_cutoff = int(total * 0.7)
        broad_cutoff = int(total * 0.9)
        
        return {
            'exact_match': [k for k, _ in sorted_keywords[:exact_cutoff]],
            'broad_match': [k for k, _ in sorted_keywords[exact_cutoff:broad_cutoff]],
            'related_match': [k for k, _ in sorted_keywords[broad_cutoff:]]
        }
        
    except Exception as e:
        logger.error(f"Error extracting keywords: {e}")
        return {'exact_match': [], 'broad_match': [], 'related_match': []}