from typing import Dict, List
import logging
from .keyword_extraction import PhraseExtractor, DensityCalculator, RelevanceScorer

logger = logging.getLogger(__name__)

async def extract_keywords(content: str) -> Dict[str, List[str]]:
    """Extract meaningful phrases that MUST exist exactly in the content."""
    try:
        if not content or len(content.strip()) < 50:
            logger.warning("Content too short for keyword extraction")
            return {'exact_match': [], 'broad_match': [], 'related_match': []}

        logger.info(f"Starting keyword extraction for content of length {len(content)}")
        logger.debug("Content sample:", content[:200])
        
        # Extract candidate phrases that actually appear in the content
        extractor = PhraseExtractor()
        phrases = extractor.extract_phrases(content)
        logger.info(f"Extracted {len(phrases)} candidate phrases that exist in content")
        
        if not phrases:
            logger.warning("No valid phrases found in content")
            return {'exact_match': [], 'broad_match': [], 'related_match': []}
        
        # Calculate density for verified phrases
        calculator = DensityCalculator()
        densities = calculator.calculate_density(content, phrases)
        logger.info(f"Calculated density for {len(densities)} verified phrases")
        
        # Score phrases for relevance
        scorer = RelevanceScorer()
        relevance_scores = await scorer.score_phrases(content, list(phrases))
        logger.info(f"Scored relevance for {len(relevance_scores)} phrases")
        
        # Combine density and relevance scores for verified phrases only
        final_scores = {}
        for phrase in phrases:
            # Double verify the phrase exists in content with exact context
            context = extractor.find_exact_context(phrase, content)
            if not context:
                logger.debug(f"Skipping phrase with no context: {phrase}")
                continue
                
            density = densities.get(phrase, 0)
            relevance = relevance_scores.get(phrase, 0)
            final_scores[phrase] = density * relevance
            
            logger.debug(f"Verified phrase: {phrase}, Density: {density:.2%}, Relevance: {relevance:.2f}, Final Score: {final_scores[phrase]:.2f}")
        
        # Sort and categorize verified phrases
        sorted_phrases = sorted(
            final_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        exact_match = []
        broad_match = []
        related_match = []
        
        for phrase, score in sorted_phrases:
            # Get the exact context for the phrase
            context = extractor.find_exact_context(phrase, content)
            if not context:
                continue
                
            density_str = f"{densities.get(phrase, 0):.2%}"
            phrase_with_context = f"{phrase} ({density_str}) - {context}"
            
            if score >= 0.8:
                exact_match.append(phrase_with_context)
            elif score >= 0.6:
                broad_match.append(phrase_with_context)
            elif score >= 0.4:
                related_match.append(phrase_with_context)
        
        logger.info(f"Final verified keyword counts: exact={len(exact_match)}, broad={len(broad_match)}, related={len(related_match)}")
        
        result = {
            'exact_match': exact_match[:10],
            'broad_match': broad_match[:10],
            'related_match': related_match[:10]
        }
        
        logger.info("Keyword extraction completed with verified phrases and contexts")
        return result
        
    except Exception as e:
        logger.error(f"Error extracting keywords: {str(e)}", exc_info=True)
        return {'exact_match': [], 'broad_match': [], 'related_match': []}