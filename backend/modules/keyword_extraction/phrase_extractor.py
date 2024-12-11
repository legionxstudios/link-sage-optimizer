from typing import List, Set
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.tag import pos_tag
from nltk.corpus import stopwords
import logging

logger = logging.getLogger(__name__)

class PhraseExtractor:
    def __init__(self):
        self.stop_words = set(stopwords.words('english'))
        
    def extract_phrases(self, text: str) -> Set[str]:
        """Extract meaningful 2-3 word phrases using POS patterns."""
        logger.info("Extracting phrases from text")
        sentences = sent_tokenize(text)
        phrases = set()
        
        for sentence in sentences:
            tokens = word_tokenize(sentence)
            pos_tags = pos_tag(tokens)
            
            # Extract 2-word phrases
            for i in range(len(pos_tags) - 1):
                if self._is_valid_bigram(pos_tags[i], pos_tags[i+1]):
                    phrase = f"{pos_tags[i][0].lower()} {pos_tags[i+1][0].lower()}"
                    if self._is_valid_phrase(phrase):
                        phrases.add(phrase)
            
            # Extract 3-word phrases
            for i in range(len(pos_tags) - 2):
                if self._is_valid_trigram(pos_tags[i], pos_tags[i+1], pos_tags[i+2]):
                    phrase = f"{pos_tags[i][0].lower()} {pos_tags[i+1][0].lower()} {pos_tags[i+2][0].lower()}"
                    if self._is_valid_phrase(phrase):
                        phrases.add(phrase)
        
        logger.info(f"Extracted {len(phrases)} unique phrases")
        return phrases
    
    def _is_valid_bigram(self, tag1, tag2) -> bool:
        """Check if two consecutive POS tags form a valid bigram."""
        valid_patterns = [
            ('JJ', 'NN'), ('NN', 'NN'), ('NNP', 'NNP'),
            ('JJ', 'NNS'), ('VBG', 'NN'), ('NN', 'NNS')
        ]
        return (tag1[1], tag2[1]) in valid_patterns
    
    def _is_valid_trigram(self, tag1, tag2, tag3) -> bool:
        """Check if three consecutive POS tags form a valid trigram."""
        valid_patterns = [
            ('JJ', 'JJ', 'NN'), ('JJ', 'NN', 'NN'),
            ('NN', 'IN', 'NN'), ('NNP', 'NNP', 'NNP')
        ]
        return (tag1[1], tag2[1], tag3[1]) in valid_patterns
    
    def _is_valid_phrase(self, phrase: str) -> bool:
        """Check if a phrase is valid (not containing stop words at edges)."""
        words = phrase.split()
        return (
            len(words) in [2, 3] and
            words[0] not in self.stop_words and
            words[-1] not in self.stop_words and
            all(len(word) > 2 for word in words)
        )