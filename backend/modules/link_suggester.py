import logging
from typing import List, Dict, Any
import httpx
import os
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

async def analyze_website_theme(content: str) -> List[str]:
    """Analyze the main theme/topics of the website content with granular sub-topics."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
                headers={"Authorization": f"Bearer {os.getenv('HUGGING_FACE_API_KEY')}"},
                json={
                    "inputs": content[:1000],  # Analyze first 1000 chars for theme
                    "parameters": {
                        "candidate_labels": [
                            # Vintage and Film Photography
                            "vintage cameras", "polaroid photography", "instant film photography",
                            "film cameras", "analog photography", "lomography",
                            "vintage polaroid", "instant cameras", "sx-70 cameras",
                            
                            # Film Types and Processes
                            "instant film", "35mm film", "medium format film",
                            "film development", "darkroom techniques", "film stocks",
                            
                            # Camera Types
                            "rangefinder cameras", "tlr cameras", "folding cameras",
                            "box cameras", "point and shoot film", "medium format cameras",
                            
                            # Modern Photography
                            "digital photography", "mirrorless cameras", "dslr photography",
                            "smartphone photography", "computational photography",
                            
                            # Photography Genres
                            "street photography", "portrait photography", "landscape photography",
                            "documentary photography", "fashion photography", "product photography",
                            
                            # Technical Aspects
                            "exposure techniques", "composition rules", "lighting setup",
                            "camera settings", "lens selection", "flash photography"
                        ]
                    }
                }
            )
            
            result = response.json()
            logger.info(f"Theme analysis result: {result}")
            
            scores = result.get("scores", [])
            labels = result.get("labels", [])
            
            # Get themes with score > 0.3
            theme_scores = list(zip(labels, scores))
            theme_scores.sort(key=lambda x: x[1], reverse=True)
            return [theme for theme, score in theme_scores if score > 0.3]
    except Exception as e:
        logger.error(f"Error analyzing website theme: {e}")
        return ["photography"]

async def generate_link_suggestions(
    content: str,
    keywords: Dict[str, List[str]],
    existing_links: List[Dict]
) -> Dict[str, List[Dict]]:
    """Generate internal link suggestions based on content analysis."""
    try:
        # First analyze the website theme
        themes = await analyze_website_theme(content)
        logger.info(f"Detected website themes: {themes}")
        
        # Create suggestions based on theme analysis
        suggestions = []
        existing_urls = {link.get('url', '') for link in existing_links}
        
        # Find relevant context for each theme
        sentences = content.split('.')
        for theme in themes:
            relevant_sentences = [
                s.strip() for s in sentences 
                if any(k.lower() in s.lower() for k in theme.split())
            ]
            
            if relevant_sentences:
                suggestion = {
                    'suggestedAnchorText': theme,
                    'context': relevant_sentences[0],
                    'matchType': 'theme_based',
                    'relevanceScore': 0.8,  # High relevance for theme-based matches
                    'themeMatch': theme
                }
                logger.info(f"Generated suggestion: {suggestion}")
                suggestions.append(suggestion)
        
        # Sort by relevance and return top suggestions
        suggestions.sort(key=lambda x: x['relevanceScore'], reverse=True)
        logger.info(f"Final suggestions count: {len(suggestions)}")
        return {'outboundSuggestions': suggestions[:10]}
        
    except Exception as e:
        logger.error(f"Error generating suggestions: {e}")
        raise