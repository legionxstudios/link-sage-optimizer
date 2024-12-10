import re
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

def find_keyword_contexts(content: str, keywords: List[str]) -> List[Dict]:
    """Find relevant contexts for keyword placement."""
    suggestions = []
    paragraphs = re.split(r'\n+', content)
    
    for keyword in keywords:
        for paragraph in paragraphs:
            if len(paragraph) < 50:  # Skip very short paragraphs
                continue
                
            # Check if the keyword or similar phrases appear in the paragraph
            if keyword.lower() in paragraph.lower():
                continue  # Skip if keyword already exists
                
            # Find semantically relevant paragraphs
            relevant_words = set(keyword.lower().split())
            paragraph_words = set(paragraph.lower().split())
            
            # If there's significant word overlap, consider it relevant
            if len(relevant_words.intersection(paragraph_words)) >= len(relevant_words) // 2:
                context = paragraph[:100] + "... [Suggested placement for '" + keyword + "'] ..." + paragraph[-100:]
                
                suggestion = {
                    'sourceUrl': "/suggested-article",
                    'targetUrl': "/target-article",
                    'suggestedAnchorText': keyword,
                    'relevanceScore': 0.85,  # This could be calculated based on word overlap
                    'context': context
                }
                suggestions.append(suggestion)
    
    return suggestions[:5]  # Limit to top 5 most relevant suggestions