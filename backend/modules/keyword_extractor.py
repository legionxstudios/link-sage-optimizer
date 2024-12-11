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
    """Extract multi-word SEO keywords from content with different match types."""
    try:
        # Initialize NLTK resources
        stop_words = set(stopwords.words('english'))
        # Add common words that shouldn't be keywords
        stop_words.update(['will', 'your', 'which', 'available'])
        
        # Pre-process content
        content = content.replace('-', ' ').replace('/', ' ').replace('_', ' ')
        sentences = sent_tokenize(content)
        
        # Extract and score keyword phrases
        keyword_phrases = []
        
        for sentence in sentences:
            tokens = word_tokenize(sentence)
            pos_tags = pos_tag(tokens)
            
            # Look specifically for 2-3 word phrases
            for i in range(len(pos_tags) - 1):
                # Two word phrases
                if (i < len(pos_tags) - 1 and 
                    pos_tags[i][1].startswith(('JJ', 'NN')) and 
                    pos_tags[i+1][1].startswith('NN')):
                    
                    phrase = f"{pos_tags[i][0].lower()} {pos_tags[i+1][0].lower()}"
                    if not any(word in stop_words for word in phrase.split()):
                        keyword_phrases.append(phrase)
                
                # Three word phrases
                if (i < len(pos_tags) - 2 and 
                    pos_tags[i][1].startswith(('JJ', 'NN')) and 
                    pos_tags[i+1][1].startswith(('JJ', 'NN')) and 
                    pos_tags[i+2][1].startswith('NN')):
                    
                    phrase = f"{pos_tags[i][0].lower()} {pos_tags[i+1][0].lower()} {pos_tags[i+2][0].lower()}"
                    if not any(word in stop_words for word in phrase.split()):
                        keyword_phrases.append(phrase)
        
        # Filter and score keywords
        business_related = [
            'digital marketing', 'web agency', 'online presence',
            'business growth', 'marketing strategy', 'client management',
            'digital solutions', 'web development', 'seo optimization',
            'content marketing', 'social media', 'lead generation',
            'customer engagement', 'business solutions', 'agency growth'
        ]
        
        # Score keyword phrases
        keyword_scores = {}
        for phrase in keyword_phrases:
            score = keyword_phrases.count(phrase)
            # Boost score for business-related terms
            if any(term in phrase.lower() for term in business_related):
                score *= 1.5
            # Boost score for phrases
            if ' ' in phrase:
                score *= 1.2
            keyword_scores[phrase] = score
        
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