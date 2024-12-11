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
        logger.info("Starting theme analysis with content length: %d", len(content))
        
        if not os.getenv('HUGGING_FACE_API_KEY'):
            logger.error("HUGGING_FACE_API_KEY not found in environment variables")
            return ["photography"]  # Default fallback
            
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
                headers={"Authorization": f"Bearer {os.getenv('HUGGING_FACE_API_KEY')}"},
                json={
                    "inputs": content[:1000],
                    "parameters": {
                        "candidate_labels": [
                            "vintage cameras", "polaroid photography", "instant film",
                            "film cameras", "analog photography", "lomography",
                            "vintage polaroid", "instant cameras", "sx-70 cameras",
                            "photography equipment", "camera reviews", "film types"
                        ],
                        "multi_label": True
                    }
                }
            )
            
            if response.status_code != 200:
                logger.error("Hugging Face API error: %s", response.text)
                return ["photography"]
                
            result = response.json()
            logger.info("Theme analysis response: %s", result)
            
            if not isinstance(result, dict) or 'scores' not in result:
                logger.error("Unexpected API response format: %s", result)
                return ["photography"]
            
            scores = result.get("scores", [])
            labels = result.get("labels", [])
            
            # Get themes with score > 0.3
            theme_scores = list(zip(labels, scores))
            theme_scores.sort(key=lambda x: x[1], reverse=True)
            selected_themes = [theme for theme, score in theme_scores if score > 0.3]
            
            logger.info("Selected themes: %s", selected_themes)
            return selected_themes or ["photography"]  # Fallback if no themes meet threshold
            
    except Exception as e:
        logger.error("Error in theme analysis: %s", str(e), exc_info=True)
        return ["photography"]

async def generate_link_suggestions(
    content: str,
    keywords: Dict[str, List[str]],
    existing_links: List[Dict]
) -> Dict[str, List[Dict]]:
    """Generate link suggestions based on content analysis."""
    try:
        logger.info("Starting link suggestion generation")
        logger.info("Content length: %d", len(content))
        logger.info("Keywords: %s", keywords)
        logger.info("Existing links count: %d", len(existing_links))
        
        # First analyze the website theme
        themes = await analyze_website_theme(content)
        logger.info("Detected themes: %s", themes)
        
        # Create suggestions based on theme analysis
        suggestions = []
        existing_urls = {link.get('url', '') for link in existing_links}
        
        # Use both themes and keywords for suggestion generation
        all_keywords = set(keywords.get('exact_match', []) + keywords.get('broad_match', []))
        
        # Find relevant context for each theme and keyword
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
                    'relevanceScore': 0.8
                }
                logger.info("Generated theme-based suggestion: %s", suggestion)
                suggestions.append(suggestion)
        
        # Add keyword-based suggestions
        for keyword in all_keywords:
            relevant_sentences = [
                s.strip() for s in sentences 
                if keyword.lower() in s.lower()
            ]
            
            if relevant_sentences:
                suggestion = {
                    'suggestedAnchorText': keyword,
                    'context': relevant_sentences[0],
                    'matchType': 'keyword_based',
                    'relevanceScore': 0.6
                }
                logger.info("Generated keyword-based suggestion: %s", suggestion)
                suggestions.append(suggestion)
        
        # Sort by relevance and return top suggestions
        suggestions.sort(key=lambda x: x['relevanceScore'], reverse=True)
        final_suggestions = suggestions[:10]  # Limit to top 10 suggestions
        
        logger.info("Final suggestions count: %d", len(final_suggestions))
        return {'outboundSuggestions': final_suggestions}
        
    except Exception as e:
        logger.error("Error generating suggestions: %s", str(e), exc_info=True)
        return {'outboundSuggestions': []}