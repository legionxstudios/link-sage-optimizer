from typing import List, Dict, Tuple
import re
import logging
from difflib import SequenceMatcher
import random

logger = logging.getLogger(__name__)

def similar(a: str, b: str) -> float:
    """Calculate similarity ratio between two strings."""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

def generate_anchor_text_variations(keyword: str) -> List[Tuple[str, str]]:
    """Generate variations of anchor text with their match types."""
    words = keyword.split()
    variations = []
    
    # Exact match (70% probability)
    variations.append((keyword, "Exact Match"))
    
    # Phrase match (20% probability)
    if len(words) > 2:
        phrase_variations = [
            ' '.join(words[:-1]),  # Remove last word
            ' '.join(words[1:]),   # Remove first word
            f"{words[0]}'s {' '.join(words[1:])}"  # Possessive form
        ]
        variations.extend([(v, "Phrase Match") for v in phrase_variations])
    
    # LSI match (10% probability)
    lsi_variations = {
        'camera': ['photography', 'photo', 'picture'],
        'lens': ['optics', 'glass', 'objective'],
        'vintage': ['classic', 'retro', 'old-school'],
        'guide': ['tutorial', 'how-to', 'walkthrough'],
        'review': ['analysis', 'evaluation', 'assessment']
    }
    
    for word in words:
        if word in lsi_variations:
            for variation in lsi_variations[word]:
                lsi_text = keyword.replace(word, variation)
                variations.append((lsi_text, "LSI Match"))
    
    return variations

def find_keyword_contexts(content: str, keywords: List[str], is_outbound: bool = True) -> List[Dict]:
    """Find relevant contexts for keyword placement."""
    suggestions = []
    paragraphs = re.split(r'\n+', content)
    
    for keyword in keywords:
        keyword_words = set(keyword.lower().split())
        
        for i, paragraph in enumerate(paragraphs):
            if len(paragraph) < 50:  # Skip very short paragraphs
                continue
                
            # For outbound links, skip if exact keyword exists
            if is_outbound and keyword.lower() in paragraph.lower():
                continue
            
            # Check for similar phrases
            has_similar = False
            for phrase in re.findall(r'\b\w+(?:\s+\w+){1,3}\b', paragraph.lower()):
                if similar(phrase, keyword) > 0.8:
                    has_similar = True
                    break
            
            if has_similar and is_outbound:
                continue
            
            # Find semantically relevant paragraphs
            paragraph_words = set(paragraph.lower().split())
            word_overlap = len(keyword_words.intersection(paragraph_words))
            
            if word_overlap >= 1:  # At least one word must match
                relevance_score = word_overlap / len(keyword_words)
                
                # Boost score based on context
                related_terms = {
                    'camera': {'photo', 'picture', 'image', 'photography', 'shoot'},
                    'lens': {'focal', 'aperture', 'glass', 'optics', 'mount'},
                    'vintage': {'classic', 'retro', 'old', 'traditional', 'historical'},
                    'guide': {'how', 'tutorial', 'learn', 'steps', 'process'},
                    'review': {'test', 'analysis', 'performance', 'quality', 'rating'}
                }
                
                for key_term, related in related_terms.items():
                    if any(term in keyword.lower() for term in [key_term]):
                        if any(term in paragraph.lower() for term in related):
                            relevance_score += 0.2
                
                if relevance_score >= 0.5:  # Only include highly relevant suggestions
                    # Get surrounding context
                    context = paragraph
                    if len(context) > 200:
                        sentences = re.split(r'[.!?]+', context)
                        best_sentence = max(sentences, key=lambda s: len(set(s.lower().split()) & keyword_words))
                        context = f"... {best_sentence.strip()} ..."
                    
                    # Generate anchor text variations
                    if not is_outbound:
                        variations = generate_anchor_text_variations(keyword)
                        # Select variation based on probability distribution
                        rand = random.random()
                        if rand < 0.7:  # 70% exact match
                            anchor_text, match_type = next(v for v in variations if v[1] == "Exact Match")
                        elif rand < 0.9:  # 20% phrase match
                            phrase_matches = [v for v in variations if v[1] == "Phrase Match"]
                            anchor_text, match_type = random.choice(phrase_matches) if phrase_matches else variations[0]
                        else:  # 10% LSI match
                            lsi_matches = [v for v in variations if v[1] == "LSI Match"]
                            anchor_text, match_type = random.choice(lsi_matches) if lsi_matches else variations[0]
                    else:
                        anchor_text = keyword
                        match_type = "Contextual"
                    
                    suggestion = {
                        'sourceUrl': "/source-article",
                        'targetUrl': "/target-article",
                        'suggestedAnchorText': anchor_text,
                        'matchType': match_type,
                        'relevanceScore': relevance_score,
                        'context': context
                    }
                    suggestions.append(suggestion)
                    logger.info(f"Found suggestion for keyword '{keyword}' with score {relevance_score}")
    
    # Sort by relevance score and return top suggestions
    suggestions.sort(key=lambda x: x['relevanceScore'], reverse=True)
    return suggestions[:10]  # Return top 10 suggestions