from typing import Dict, List
import logging
from .keyword_extraction import PhraseExtractor, DensityCalculator, RelevanceScorer

logger = logging.getLogger(__name__)

async def extract_keywords(content: str) -> Dict[str, List[str]]:
    """Extract meaningful 2-3 word phrases with density and relevance analysis."""
    try:
        logger.info("Starting keyword extraction")
        
        # Extract candidate phrases
        extractor = PhraseExtractor()
        phrases = extractor.extract_phrases(content)
        logger.info(f"Extracted {len(phrases)} candidate phrases")
        
        if not phrases:
            return {'exact_match': [], 'broad_match': [], 'related_match': []}
        
        # Calculate density for each phrase
        calculator = DensityCalculator()
        densities = calculator.calculate_density(content, phrases)
        
        # Score phrases for relevance
        scorer = RelevanceScorer()
        relevance_scores = await scorer.score_phrases(content, list(phrases))
        
        # Combine density and relevance scores
        final_scores = {}
        for phrase in phrases:
            if len(phrase.split()) not in [2, 3]:
                continue
                
            density = densities.get(phrase, 0)
            relevance = relevance_scores.get(phrase, 0)
            final_scores[phrase] = density * relevance
        
        # Sort and categorize phrases
        sorted_phrases = sorted(
            final_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        exact_match = []
        broad_match = []
        related_match = []
        
        for phrase, score in sorted_phrases:
            if len(phrase.split()) not in [2, 3]:
                continue
                
            density_str = f"{densities.get(phrase, 0):.2%}"
            phrase_with_density = f"{phrase} ({density_str})"
            
            if score >= 0.8:
                exact_match.append(phrase_with_density)
            elif score >= 0.6:
                broad_match.append(phrase_with_density)
            elif score >= 0.4:
                related_match.append(phrase_with_density)
        
        logger.info(f"Final keyword counts: exact={len(exact_match)}, broad={len(broad_match)}, related={len(related_match)}")
        
        return {
            'exact_match': exact_match[:15],
            'broad_match': broad_match[:15],
            'related_match': related_match[:15]
        }
        
    except Exception as e:
        logger.error(f"Error extracting keywords: {e}")
        return {'exact_match': [], 'broad_match': [], 'related_match': []}