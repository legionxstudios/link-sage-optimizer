from transformers import pipeline
import re
from typing import List
import logging

logger = logging.getLogger(__name__)

def extract_ngrams(text: str, n: int) -> List[str]:
    """Extract n-gram phrases from text."""
    words = text.lower().split()
    ngrams = []
    for i in range(len(words) - n + 1):
        ngram = ' '.join(words[i:i + n])
        if not re.match(r'^(the|a|an|and|or|but|in|on|at|to|for|of|with)\s', ngram):
            ngrams.append(ngram)
    return ngrams

def extract_keywords(content: str) -> List[str]:
    """Extract keywords using zero-shot classification and n-grams."""
    try:
        # Extract 2-gram and 3-gram phrases from the content
        bigrams = extract_ngrams(content, 2)
        trigrams = extract_ngrams(content, 3)
        
        # Get the most frequent n-grams as candidate labels
        candidate_keywords = list(set(bigrams + trigrams))[:20]  # Limit to top 20 candidates
        
        # Initialize zero-shot classifier
        classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")
        
        # Split content into chunks if it's too long
        max_length = 1024
        content_chunks = [content[i:i + max_length] for i in range(0, len(content), max_length)]
        
        all_keywords = set()
        for chunk in content_chunks:
            result = classifier(chunk, candidate_keywords, multi_label=True)
            # Filter keywords with high confidence
            keywords = [label for label, score in zip(result['labels'], result['scores']) if score > 0.7]
            all_keywords.update(keywords)
        
        logger.info(f"Extracted keywords: {all_keywords}")
        return list(all_keywords)
    except Exception as e:
        logger.error(f"Error extracting keywords: {str(e)}")
        return []