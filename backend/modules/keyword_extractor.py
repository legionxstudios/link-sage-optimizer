from typing import List
import re
import logging
from collections import Counter
import nltk
from nltk.util import ngrams
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords

logger = logging.getLogger(__name__)

try:
    nltk.data.find('tokenizers/punkt')
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('punkt')
    nltk.download('stopwords')

def clean_text(text: str) -> str:
    """Clean text by removing special characters and extra whitespace."""
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.lower().strip()

def extract_keywords(content: str) -> List[str]:
    """Extract meaningful keyword phrases from content."""
    try:
        # Clean the text
        cleaned_content = clean_text(content)
        
        # Tokenize
        tokens = word_tokenize(cleaned_content)
        stop_words = set(stopwords.words('english'))
        
        # Generate n-grams (2-4 words)
        keyword_candidates = []
        for n in range(2, 5):
            n_grams = list(ngrams(tokens, n))
            for gram in n_grams:
                phrase = ' '.join(gram)
                # Filter out phrases that:
                # 1. Start or end with stop words
                # 2. Contain only stop words
                # 3. Are too short
                words = phrase.split()
                if (words[0] not in stop_words and 
                    words[-1] not in stop_words and 
                    any(word not in stop_words for word in words) and
                    len(phrase) > 5):
                    keyword_candidates.append(phrase)
        
        # Count frequency of phrases
        phrase_counts = Counter(keyword_candidates)
        
        # Get the most common phrases (normalized by length)
        scored_phrases = [
            (phrase, count * len(phrase.split()))  # Favor longer phrases
            for phrase, count in phrase_counts.items()
        ]
        
        # Sort by score and take top 10
        keywords = [
            phrase for phrase, score 
            in sorted(scored_phrases, key=lambda x: x[1], reverse=True)[:10]
        ]
        
        logger.info(f"Extracted keywords: {keywords}")
        return keywords
    except Exception as e:
        logger.error(f"Error extracting keywords: {str(e)}")
        return []