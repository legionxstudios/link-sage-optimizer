import logging
from typing import List, Dict, Any
import httpx
import os
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

async def analyze_content(content: str) -> Dict[str, Any]:
    """Analyze the full content using HuggingFace API."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Analyze content with a broader set of labels
            response = await client.post(
                "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
                headers={"Authorization": f"Bearer {os.getenv('HUGGING_FACE_API_KEY')}"},
                json={
                    "inputs": content[:2000],  # Analyze larger chunk of content
                    "parameters": {
                        "candidate_labels": [
                            "technical guide",
                            "product review",
                            "tutorial",
                            "case study",
                            "industry news",
                            "how-to guide",
                            "comparison",
                            "best practices",
                            "tips and tricks",
                            "expert advice"
                        ]
                    }
                }
            )
            
            result = response.json()
            logger.info(f"Content analysis result: {result}")
            
            if "error" in result:
                logger.error(f"API error: {result['error']}")
                return {"content_type": "article", "relevance_scores": {}}
            
            scores = result.get("scores", [])
            labels = result.get("labels", [])
            
            return {
                "content_type": labels[0] if labels else "article",
                "relevance_scores": dict(zip(labels, scores))
            }
            
    except Exception as e:
        logger.error(f"Error analyzing content: {e}")
        return {"content_type": "article", "relevance_scores": {}}

async def generate_link_suggestions(
    content: str,
    keywords: Dict[str, List[str]],
    existing_links: List[Dict]
) -> Dict[str, List[Dict]]:
    """Generate link suggestions based on comprehensive content analysis."""
    try:
        logger.info("Starting content analysis for link suggestions")
        
        # First analyze the full content
        content_analysis = await analyze_content(content)
        logger.info(f"Content analysis completed: {content_analysis}")
        
        suggestions = []
        existing_urls = {link.get('url', '') for link in existing_links}
        
        # Split content into sentences for context extraction
        sentences = content.split('.')
        
        # Generate suggestions based on content type and keywords
        content_type = content_analysis['content_type']
        relevance_scores = content_analysis['relevance_scores']
        
        # Add content-type based suggestions
        if content_type and content_type in relevance_scores:
            relevant_sentences = [
                s.strip() for s in sentences 
                if any(word in s.lower() for word in content_type.split())
            ]
            
            if relevant_sentences:
                suggestion = {
                    'suggestedAnchorText': content_type.title(),
                    'context': relevant_sentences[0],
                    'matchType': 'content_based',
                    'relevanceScore': relevance_scores[content_type],
                    'contentType': content_type
                }
                logger.info(f"Generated content-based suggestion: {suggestion}")
                suggestions.append(suggestion)
        
        # Add keyword-based suggestions
        for keyword in keywords.get('exact_match', [])[:5]:  # Limit to top 5 keywords
            relevant_sentences = [
                s.strip() for s in sentences 
                if keyword.lower() in s.lower()
            ]
            
            if relevant_sentences:
                suggestion = {
                    'suggestedAnchorText': keyword,
                    'context': relevant_sentences[0],
                    'matchType': 'keyword_based',
                    'relevanceScore': 0.8,  # High relevance for exact keyword matches
                    'keywordMatch': keyword
                }
                suggestions.append(suggestion)
        
        # Add broad match suggestions
        for keyword in keywords.get('broad_match', [])[:3]:  # Limit to top 3 broad matches
            relevant_sentences = [
                s.strip() for s in sentences 
                if keyword.lower() in s.lower()
            ]
            
            if relevant_sentences:
                suggestion = {
                    'suggestedAnchorText': keyword,
                    'context': relevant_sentences[0],
                    'matchType': 'broad_match',
                    'relevanceScore': 0.6,  # Medium relevance for broad matches
                    'keywordMatch': keyword
                }
                suggestions.append(suggestion)
        
        # Sort by relevance and return top suggestions
        suggestions.sort(key=lambda x: x['relevanceScore'], reverse=True)
        logger.info(f"Final suggestions count: {len(suggestions)}")
        return {'outboundSuggestions': suggestions[:10]}  # Limit to top 10 suggestions
        
    except Exception as e:
        logger.error(f"Error generating suggestions: {e}")
        return {'outboundSuggestions': []}