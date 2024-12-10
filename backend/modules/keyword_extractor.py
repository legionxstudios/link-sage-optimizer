from typing import List, Dict
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

class KeywordExtractor:
    def __init__(self, content: str):
        self.content = content
        self.stop_words = set(stopwords.words('english'))
        self.sentences = sent_tokenize(content)

    def extract_keywords(self) -> Dict[str, List[str]]:
        """Extract keywords with different match types."""
        # Get all potential keyword phrases
        keyword_candidates = self._extract_keyword_candidates()
        
        # Score and categorize keywords
        scored_keywords = self._score_keywords(keyword_candidates)
        
        # Split into match types (70-20-10 distribution)
        exact_matches = []
        broad_matches = []
        related_matches = []
        
        for keyword, score in scored_keywords:
            if len(exact_matches) < int(len(scored_keywords) * 0.7):
                exact_matches.append(keyword)
            elif len(broad_matches) < int(len(scored_keywords) * 0.2):
                broad_matches.append(keyword)
            elif len(related_matches) < int(len(scored_keywords) * 0.1):
                related_matches.append(keyword)
                
        return {
            'exact_match': exact_matches,
            'broad_match': broad_matches,
            'related_match': related_matches
        }

    def _extract_keyword_candidates(self) -> List[str]:
        """Extract potential keyword phrases from content."""
        candidates = []
        
        for sentence in self.sentences:
            # Tokenize and tag parts of speech
            tokens = word_tokenize(sentence)
            pos_tags = pos_tag(tokens)
            
            # Generate n-grams (1-3 words)
            for n in range(1, 4):
                n_grams = list(ngrams(pos_tags, n))
                
                for gram in n_grams:
                    words = [word.lower() for word, tag in gram]
                    tags = [tag for _, tag in gram]
                    
                    # Check if phrase is a good candidate
                    if self._is_valid_phrase(words, tags):
                        phrase = ' '.join(words)
                        if len(phrase) > 3:  # Avoid very short phrases
                            candidates.append(phrase)
        
        return candidates

    def _is_valid_phrase(self, words: List[str], tags: List[str]) -> bool:
        """Check if a phrase is valid for keyword consideration."""
        return (
            # Contains at least one noun
            any(tag.startswith('NN') for tag in tags) and
            # Doesn't start or end with stop words
            words[0] not in self.stop_words and
            words[-1] not in self.stop_words and
            # Not all words are stop words
            any(word not in self.stop_words for word in words)
        )

    def _score_keywords(self, candidates: List[str]) -> List[tuple]:
        """Score keyword candidates based on various factors."""
        # Count frequency
        counts = Counter(candidates)
        
        # Calculate scores
        scored_phrases = []
        for phrase, count in counts.items():
            # Base score from frequency
            score = count
            
            # Boost score for phrases that appear in title-like positions
            first_occurrence = self.content.lower().find(phrase)
            if first_occurrence < len(self.content) / 3:
                score *= 1.5
            
            # Boost for noun phrases
            if len(phrase.split()) > 1:
                score *= 1.2
            
            scored_phrases.append((phrase, score))
        
        # Sort by score and take top 20
        return sorted(scored_phrases, key=lambda x: x[1], reverse=True)[:20]

def extract_keywords(content: str) -> Dict[str, List[str]]:
    """Main function to extract keywords from content."""
    try:
        extractor = KeywordExtractor(content)
        return extractor.extract_keywords()
    except Exception as e:
        logger.error(f"Error extracting keywords: {str(e)}")
        raise