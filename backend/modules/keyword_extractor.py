from typing import List
import re
import logging
from collections import Counter
import nltk
from nltk.util import ngrams
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.corpus import stopwords
from nltk.tag import pos_tag

logger = logging.getLogger(__name__)

try:
    nltk.data.find('tokenizers/punkt')
    nltk.data.find('corpora/stopwords')
    nltk.data.find('averaged_perceptron_tagger')
except LookupError:
    nltk.download('punkt')
    nltk.download('stopwords')
    nltk.download('averaged_perceptron_tagger')

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
        
        # Tokenize into sentences first
        sentences = sent_tokenize(cleaned_content)
        
        # Process each sentence
        keyword_candidates = []
        stop_words = set(stopwords.words('english'))
        
        for sentence in sentences:
            # Tokenize and tag parts of speech
            tokens = word_tokenize(sentence)
            pos_tags = pos_tag(tokens)
            
            # Generate n-grams (2-4 words)
            for n in range(2, 5):
                n_grams = list(ngrams(pos_tags, n))
                
                for gram in n_grams:
                    words = [word.lower() for word, tag in gram]
                    tags = [tag for _, tag in gram]
                    
                    # Check if the phrase is a good candidate:
                    # 1. Contains at least one noun (NN*)
                    # 2. Doesn't start or end with stop words
                    # 3. Not all words are stop words
                    if (any(tag.startswith('NN') for tag in tags) and
                        words[0] not in stop_words and
                        words[-1] not in stop_words and
                        any(word not in stop_words for word in words)):
                        
                        phrase = ' '.join(words)
                        if len(phrase) > 5:  # Avoid very short phrases
                            keyword_candidates.append(phrase)
        
        # Count frequency and calculate scores
        phrase_counts = Counter(keyword_candidates)
        
        # Score phrases based on:
        # 1. Frequency
        # 2. Length (favor longer phrases)
        # 3. Position in text (earlier phrases might be more important)
        scored_phrases = []
        for phrase, count in phrase_counts.items():
            # Base score from frequency
            score = count
            
            # Boost score for longer phrases
            words = phrase.split()
            length_boost = len(words) / 2  # Longer phrases get higher boost
            score *= length_boost
            
            # Boost for phrases that appear in first third of the content
            first_occurrence = cleaned_content.find(phrase)
            if first_occurrence != -1 and first_occurrence < len(cleaned_content) / 3:
                score *= 1.5
                
            scored_phrases.append((phrase, score))
        
        # Sort by score and take top 15
        keywords = [
            phrase for phrase, _ 
            in sorted(scored_phrases, key=lambda x: x[1], reverse=True)[:15]
        ]
        
        logger.info(f"Extracted keywords: {keywords}")
        return keywords
    except Exception as e:
        logger.error(f"Error extracting keywords: {str(e)}")
        return []