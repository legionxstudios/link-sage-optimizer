import logging
from typing import List, Dict, Any
import httpx
import os
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

async def analyze_content(content: str) -> Dict[str, Any]:
    """Analyze the full content using OpenAI API."""
    try:
        logger.info("Starting content analysis with OpenAI")
        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {
                "model": "gpt-4",  # Fixed model name
                "messages": [
                    {
                        "role": "system",
                        "content": """You are an expert content analyzer. For the given content:
                        1. Identify the main topics and themes
                        2. Suggest specific areas where external references would add value
                        3. Return your analysis in a clear, structured format"""
                    },
                    {
                        "role": "user",
                        "content": f"Analyze this content and suggest link opportunities: {content[:2000]}"
                    }
                ]
            }
            
            logger.info(f"Sending request to OpenAI with payload: {payload}")
            
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {os.getenv('OPENAI_API_KEY')}"},
                json=payload
            )
            
            result = response.json()
            logger.info(f"Received response from OpenAI: {result}")
            
            if "error" in result:
                logger.error(f"OpenAI API error: {result['error']}")
                return {"content_type": "article", "relevance_scores": {}}
            
            if not result.get('choices'):
                logger.error("No choices in OpenAI response")
                return {"content_type": "article", "relevance_scores": {}}
                
            analysis = result['choices'][0]['message']['content']
            logger.info(f"Analysis from OpenAI: {analysis}")
            
            # Define content types and their base relevance scores
            content_types = {
                "technical guide": 0.9,
                "tutorial": 0.85,
                "product review": 0.8,
                "case study": 0.75,
                "how-to guide": 0.85,
                "comparison": 0.8,
                "best practices": 0.85,
                "tips and tricks": 0.75
            }
            
            # Determine content type based on OpenAI's analysis
            detected_type = "article"
            max_score = 0
            
            for content_type, base_score in content_types.items():
                if content_type.lower() in analysis.lower():
                    if base_score > max_score:
                        detected_type = content_type
                        max_score = base_score
            
            logger.info(f"Detected content type: {detected_type} with score: {max_score}")
            
            return {
                "content_type": detected_type,
                "relevance_scores": {
                    ctype: score if ctype == detected_type else score * 0.5
                    for ctype, score in content_types.items()
                }
            }
            
    except Exception as e:
        logger.error(f"Error analyzing content with OpenAI: {str(e)}", exc_info=True)
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
        logger.error(f"Error generating suggestions: {str(e)}", exc_info=True)
        return {'outboundSuggestions': []}