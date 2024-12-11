from typing import Dict, List
import logging
from .keyword_extraction import PhraseExtractor, DensityCalculator, RelevanceScorer

logger = logging.getLogger(__name__)

async def extract_keywords(content: str) -> Dict[str, List[str]]:
    """Extract meaningful 2-3 word phrases with density and relevance analysis."""
    try:
        if not content or len(content.strip()) < 50:
            logger.warning("Content too short for keyword extraction")
            return {'exact_match': [], 'broad_match': [], 'related_match': []}

        logger.info(f"Starting keyword extraction for content of length {len(content)}")
        
        # Extract candidate phrases
        extractor = PhraseExtractor()
        phrases = extractor.extract_phrases(content)
        logger.info(f"Extracted {len(phrases)} candidate phrases")
        
        if not phrases:
            logger.warning("No phrases extracted from content")
            return {'exact_match': [], 'broad_match': [], 'related_match': []}
        
        # Calculate density for each phrase
        calculator = DensityCalculator()
        densities = calculator.calculate_density(content, phrases)
        logger.info(f"Calculated density for {len(densities)} phrases")
        
        # Score phrases for relevance
        scorer = RelevanceScorer()
        relevance_scores = await scorer.score_phrases(content, list(phrases))
        logger.info(f"Scored relevance for {len(relevance_scores)} phrases")
        
        # Combine density and relevance scores
        final_scores = {}
        for phrase in phrases:
            if len(phrase.split()) not in [2, 3]:
                continue
                
            density = densities.get(phrase, 0)
            relevance = relevance_scores.get(phrase, 0)
            final_scores[phrase] = density * relevance
            
            logger.debug(f"Phrase: {phrase}, Density: {density:.2%}, Relevance: {relevance:.2f}, Final Score: {final_scores[phrase]:.2f}")
        
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
        
        result = {
            'exact_match': exact_match[:15],
            'broad_match': broad_match[:15],
            'related_match': related_match[:15]
        }
        
        logger.info("Keyword extraction completed successfully")
        return result
        
    except Exception as e:
        logger.error(f"Error extracting keywords: {str(e)}", exc_info=True)
        return {'exact_match': [], 'broad_match': [], 'related_match': []}