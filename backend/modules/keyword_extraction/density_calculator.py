from typing import Dict, Set
import re
import logging

logger = logging.getLogger(__name__)

class DensityCalculator:
    def calculate_density(self, content: str, phrases: Set[str]) -> Dict[str, float]:
        """Calculate the density of each phrase in the content."""
        logger.info("Calculating keyword density")
        
        # Count total words in content (for normalization)
        total_words = len(content.split())
        if total_words == 0:
            logger.warning("Empty content provided")
            return {}
        
        # Calculate density for each phrase
        densities = {}
        content_lower = content.lower()
        
        for phrase in phrases:
            # Create pattern with word boundaries
            pattern = r'\b' + re.escape(phrase.lower()) + r'\b'
            count = len(re.findall(pattern, content_lower))
            
            if count > 0:
                # Normalize by phrase length and total words
                phrase_words = len(phrase.split())
                density = (count * phrase_words) / total_words
                densities[phrase] = density
                logger.debug(f"Phrase '{phrase}' density: {density:.4f}")
        
        logger.info(f"Calculated density for {len(densities)} phrases")
        return densities