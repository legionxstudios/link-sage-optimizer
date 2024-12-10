from typing import List, Dict
import re
import logging
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)

def similar(a: str, b: str) -> float:
    """Calculate similarity ratio between two strings."""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

def find_keyword_contexts(content: str, keywords: List[str]) -> List[Dict]:
    """Find relevant contexts for keyword placement."""
    suggestions = []
    paragraphs = re.split(r'\n+', content)
    
    for keyword in keywords:
        keyword_words = set(keyword.lower().split())
        
        for i, paragraph in enumerate(paragraphs):
            if len(paragraph) < 50:  # Skip very short paragraphs
                continue
            
            # Skip if the exact keyword already exists
            if keyword.lower() in paragraph.lower():
                continue
            
            # Check for similar phrases to avoid redundant suggestions
            has_similar = False
            for phrase in re.findall(r'\b\w+(?:\s+\w+){1,3}\b', paragraph.lower()):
                if similar(phrase, keyword) > 0.8:
                    has_similar = True
                    break
            
            if has_similar:
                continue
            
            # Find semantically relevant paragraphs
            paragraph_words = set(paragraph.lower().split())
            word_overlap = len(keyword_words.intersection(paragraph_words))
            
            # Calculate relevance score based on word overlap and context
            if word_overlap >= 1:  # At least one word must match
                relevance_score = word_overlap / len(keyword_words)
                
                # Boost score if paragraph contains related terms
                related_terms = {
                    'camera': {'photo', 'picture', 'image', 'photography'},
                    'bulk': {'wholesale', 'quantity', 'multiple', 'many'},
                    'disposable': {'single-use', 'one-time', 'temporary'}
                }
                
                for key_term, related in related_terms.items():
                    if any(term in keyword.lower() for term in [key_term]):
                        if any(term in paragraph.lower() for term in related):
                            relevance_score += 0.2
                
                if relevance_score >= 0.5:  # Only include highly relevant suggestions
                    # Get surrounding context
                    context = paragraph
                    if len(context) > 200:
                        # Find the most relevant sentence
                        sentences = re.split(r'[.!?]+', context)
                        best_sentence = max(sentences, key=lambda s: len(set(s.lower().split()) & keyword_words))
                        context = f"... {best_sentence.strip()} ..."
                    
                    suggestion = {
                        'sourceUrl': "/suggested-article",
                        'targetUrl': "/target-article",
                        'suggestedAnchorText': keyword,
                        'relevanceScore': relevance_score,
                        'context': context
                    }
                    suggestions.append(suggestion)
                    logger.info(f"Found suggestion for keyword '{keyword}' with score {relevance_score}")
    
    # Sort by relevance score and return top suggestions
    suggestions.sort(key=lambda x: x['relevanceScore'], reverse=True)
    return suggestions[:5]