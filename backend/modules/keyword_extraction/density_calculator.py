from typing import Dict, List, Set
from collections import Counter
import logging

logger = logging.getLogger(__name__)

class DensityCalculator:
    def calculate_density(self, content: str, phrases: Set[str]) -> Dict[str, float]:
        """Calculate the density of each phrase in the content."""
        logger.info("Calculating keyword density")
        
        # Count total words in content (for normalization)
        total_words = len(content.split())
        
        # Count occurrences of each phrase
        densities = {}
        for phrase in phrases:
            count = content.lower().count(phrase.lower())
            if count > 0:
                # Normalize by phrase length and total words
                phrase_words = len(phrase.split())
                density = (count * phrase_words) / total_words
                densities[phrase] = density
        
        logger.info(f"Calculated density for {len(densities)} phrases")
        return densities