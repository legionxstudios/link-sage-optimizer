import logging
from typing import List, Dict, Any
import httpx
import os
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

async def analyze_website_theme(content: str) -> List[str]:
    """Analyze the main theme/topics of the website content."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
                headers={"Authorization": f"Bearer {os.getenv('HUGGING_FACE_API_KEY')}"},
                json={
                    "inputs": content[:1000],  # Analyze first 1000 chars for theme
                    "parameters": {
                        "candidate_labels": [
                            "photography", "art", "business", "technology", 
                            "travel", "lifestyle", "fashion", "food",
                            "health", "education", "sports"
                        ]
                    }
                }
            )
            
            result = response.json()
            scores = result.get("scores", [])
            labels = result.get("labels", [])
            
            # Get top 3 themes with score > 0.3
            theme_scores = list(zip(labels, scores))
            theme_scores.sort(key=lambda x: x[1], reverse=True)
            return [theme for theme, score in theme_scores if score > 0.3][:3]
    except Exception as e:
        logger.error(f"Error analyzing website theme: {e}")
        return ["general"]

async def generate_seo_keywords(content: str, themes: List[str]) -> List[Dict]:
    """Generate SEO-friendly keywords based on content and themes."""
    try:
        # Combine themes into a context prompt
        theme_context = f"This is a website about {', '.join(themes)}. "
        prompt = f"{theme_context}Generate SEO keywords from this content: {content[:500]}"
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
                headers={"Authorization": f"Bearer {os.getenv('HUGGING_FACE_API_KEY')}"},
                json={
                    "inputs": prompt,
                    "parameters": {
                        "candidate_labels": [
                            # Theme-specific keywords
                            "professional photography", "portrait photography", "wedding photos",
                            "photo studio", "photography services", "photo gallery",
                            "professional photographer", "photo session", "photography portfolio",
                            "commercial photography", "event photography", "photography pricing",
                            # Location-based keywords (if relevant)
                            "local photographer", "photography near me", "studio location",
                            # Service-based keywords
                            "book photo session", "photography packages", "photo editing",
                            "photography consultation", "photography booking"
                        ]
                    }
                }
            )
            
            result = response.json()
            scores = result.get("scores", [])
            labels = result.get("labels", [])
            
            # Return keywords with high relevance
            keywords = []
            for label, score in zip(labels, scores):
                if score > 0.4:  # Only keep highly relevant keywords
                    keywords.append({
                        "keyword": label,
                        "relevance": score
                    })
            
            return sorted(keywords, key=lambda x: x["relevance"], reverse=True)
    except Exception as e:
        logger.error(f"Error generating SEO keywords: {e}")
        return []

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
        
        # Generate SEO-friendly keywords based on theme
        seo_keywords = await generate_seo_keywords(content, themes)
        logger.info(f"Generated SEO keywords: {seo_keywords}")
        
        # Create suggestions based on SEO keywords
        suggestions = []
        existing_urls = {link.get('url', '') for link in existing_links}
        
        for kw_data in seo_keywords:
            keyword = kw_data["keyword"]
            relevance = kw_data["relevance"]
            
            # Find relevant context for this keyword
            sentences = [s.strip() for s in content.split('.') 
                        if keyword.lower() in s.lower()]
            
            if sentences:
                suggestions.append({
                    'suggestedAnchorText': keyword,
                    'context': sentences[0],
                    'matchType': 'seo_optimized',
                    'relevanceScore': relevance,
                    'themeMatch': themes[0] if themes else 'general'
                })
        
        # Sort by relevance and return top suggestions
        suggestions.sort(key=lambda x: x['relevanceScore'], reverse=True)
        return {'outboundSuggestions': suggestions[:10]}
        
    except Exception as e:
        logger.error(f"Error generating suggestions: {e}")
        raise