from typing import Set, List, Dict, Tuple
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.tag import pos_tag
from nltk.corpus import stopwords
import logging
import re

logger = logging.getLogger(__name__)

class PhraseExtractor:
    def __init__(self):
        self.stop_words = set(stopwords.words('english'))
        
    def extract_phrases(self, text: str) -> Set[str]:
        """Extract phrases that EXACTLY exist in the content with their contexts."""
        logger.info("Extracting exact phrases from text")
        
        # Split into sentences for better context
        sentences = sent_tokenize(text)
        phrases = set()
        
        # First get candidate phrases
        for sentence in sentences:
            tokens = word_tokenize(sentence)
            pos_tags = pos_tag(tokens)
            
            # Extract 2-word phrases
            for i in range(len(pos_tags) - 1):
                if self._is_valid_bigram(pos_tags[i], pos_tags[i+1]):
                    phrase = f"{pos_tags[i][0]} {pos_tags[i+1][0]}"
                    if self._verify_exact_match(phrase, text):
                        phrases.add(phrase)
            
            # Extract 3-word phrases
            for i in range(len(pos_tags) - 2):
                if self._is_valid_trigram(pos_tags[i], pos_tags[i+1], pos_tags[i+2]):
                    phrase = f"{pos_tags[i][0]} {pos_tags[i+1][0]} {pos_tags[i+2][0]}"
                    if self._verify_exact_match(phrase, text):
                        phrases.add(phrase)
        
        logger.info(f"Extracted {len(phrases)} exact phrases from content")
        return phrases
    
    def _verify_exact_match(self, phrase: str, text: str) -> bool:
        """Verify that the phrase exists exactly in the text with word boundaries."""
        # Create pattern with word boundaries and optional spaces
        pattern = r'\b' + re.escape(phrase) + r'\b'
        match = re.search(pattern, text)
        
        if match:
            # Get the exact phrase as it appears in the text
            exact_phrase = text[match.start():match.end()]
            logger.debug(f"Found exact match: '{exact_phrase}' for phrase: '{phrase}'")
            return True
            
        return False
    
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
    
    def find_exact_context(self, phrase: str, text: str, context_length: int = 100) -> str:
        """Find the exact context where a phrase appears in the text."""
        pattern = r'\b' + re.escape(phrase) + r'\b'
        match = re.search(pattern, text)
        
        if not match:
            logger.warning(f"Could not find exact context for phrase: {phrase}")
            return ""
            
        start_pos = match.start()
        end_pos = match.end()
        
        # Get surrounding context
        context_start = max(0, start_pos - context_length)
        context_end = min(len(text), end_pos + context_length)
        
        # Get the exact phrase as it appears in the text
        exact_phrase = text[start_pos:end_pos]
        context = text[context_start:context_end].strip()
        
        # Highlight the exact phrase in the context
        highlighted_context = context.replace(exact_phrase, f"[{exact_phrase}]")
        
        logger.info(f"Found context for phrase '{phrase}': {highlighted_context}")
        return highlighted_context