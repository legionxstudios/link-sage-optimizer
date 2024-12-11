import logging
from typing import List, Dict, Any
import os
from dotenv import load_dotenv
import json
import openai

load_dotenv()
logger = logging.getLogger(__name__)

# Configure OpenAI client
openai.api_key = os.getenv('OPENAI_API_KEY')

async def analyze_content(content: str) -> Dict[str, Any]:
    """Analyze content using OpenAI function calling to extract key phrases."""
    try:
        logger.info("Starting content analysis with OpenAI function calling")
        logger.info(f"Content length: {len(content)}")
        
        function_definition = {
            "name": "extract_key_phrases",
            "description": "Extract ONLY 2-3 word key phrases that represent the main topics from the content. Each phrase must be exactly 2-3 words long.",
            "parameters": {
                "type": "object",
                "properties": {
                    "key_phrases": {
                        "type": "array",
                        "items": {
                            "type": "string",
                            "description": "A 2-3 word phrase representing a key topic"
                        },
                        "description": "List of 2-3 word key phrases extracted from the text."
                    }
                },
                "required": ["key_phrases"]
            }
        }

        try:
            logger.info("Sending request to OpenAI")
            response = await openai.ChatCompletion.acreate(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert at identifying key 2-3 word phrases for SEO interlinking. ONLY return phrases that are exactly 2-3 words long."
                    },
                    {
                        "role": "user",
                        "content": f"Extract 10 key phrases (EXACTLY 2-3 words each) that represent the main topics of the following content:\n\n{content[:2000]}\n\nEnsure each phrase is EXACTLY 2-3 words long."
                    }
                ],
                functions=[function_definition],
                function_call={"name": "extract_key_phrases"}
            )
            
            logger.info("Received response from OpenAI")
            logger.debug(f"OpenAI response: {response}")
            
            if not response.choices:
                logger.error("No choices in OpenAI response")
                return []
                
            try:
                function_call = response.choices[0].message.function_call
                if not function_call:
                    logger.error("No function call in response")
                    return []
                    
                arguments = json.loads(function_call.arguments)
                key_phrases = arguments.get('key_phrases', [])
                
                # Validate phrase length
                key_phrases = [
                    phrase for phrase in key_phrases 
                    if 2 <= len(phrase.split()) <= 3
                ]
                
                logger.info(f"Extracted {len(key_phrases)} valid key phrases")
                return key_phrases
                
            except Exception as e:
                logger.error(f"Error parsing OpenAI response: {str(e)}")
                return []
                
        except Exception as e:
            logger.error(f"OpenAI API error: {str(e)}")
            return []
            
    except Exception as e:
        logger.error(f"Error in content analysis: {str(e)}", exc_info=True)
        return []

async def generate_link_suggestions(
    content: str,
    keywords: Dict[str, List[str]],
    existing_links: List[Dict]
) -> Dict[str, List[Dict]]:
    """Generate link suggestions based on content analysis and find relevant target pages."""
    try:
        logger.info("Starting link suggestion generation")
        logger.info(f"Content length: {len(content)}")
        logger.info(f"Keywords: {keywords}")
        logger.info(f"Existing links count: {len(existing_links)}")
        
        # Get key phrases from OpenAI
        key_phrases = await analyze_content(content)
        if not key_phrases:
            logger.warning("No key phrases generated")
            return {'outboundSuggestions': []}
            
        logger.info(f"Generated {len(key_phrases)} key phrases")
        
        # Initialize Supabase client
        from supabase import create_client
        supabase = create_client(
            os.getenv('SUPABASE_URL', ''),
            os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
        )
        
        suggestions = []
        
        # For each key phrase, find relevant pages in our database
        for phrase in key_phrases:
            try:
                # Search for pages containing this phrase in title or content
                response = await supabase.table('pages').select('url, title, content') \
                    .or_(f"title.ilike.%{phrase}%,content.ilike.%{phrase}%") \
                    .limit(3) \
                    .execute()
                
                relevant_pages = response.data
                logger.info(f"Found {len(relevant_pages)} relevant pages for phrase: {phrase}")
                
                # Find relevant context in the content
                phrase_context = find_phrase_context(content, phrase)
                
                # Create suggestions for each relevant page
                for page in relevant_pages:
                    suggestions.append({
                        "suggestedAnchorText": phrase,
                        "context": phrase_context,
                        "matchType": "keyword_based",
                        "relevanceScore": calculate_relevance_score(phrase, page),
                        "targetUrl": page['url'],
                        "targetTitle": page['title']
                    })
                    
            except Exception as e:
                logger.error(f"Error processing phrase {phrase}: {str(e)}")
                continue
        
        # Sort by relevance score and limit to top suggestions
        suggestions.sort(key=lambda x: x['relevanceScore'], reverse=True)
        suggestions = suggestions[:10]
        
        logger.info(f"Generated {len(suggestions)} final suggestions")
        return {'outboundSuggestions': suggestions}
        
    except Exception as e:
        logger.error(f"Error generating suggestions: {str(e)}", exc_info=True)
        return {'outboundSuggestions': []}

def find_phrase_context(content: str, phrase: str, context_length: int = 100) -> str:
    """Find the surrounding context for a phrase in the content."""
    try:
        phrase_lower = phrase.lower()
        content_lower = content.lower()
        
        # Find the phrase position
        pos = content_lower.find(phrase_lower)
        if pos == -1:
            return ""
            
        # Get surrounding context
        start = max(0, pos - context_length)
        end = min(len(content), pos + len(phrase) + context_length)
        
        context = content[start:end].strip()
        # Highlight the phrase
        context = context.replace(phrase, f"[{phrase}]")
        
        return context
        
    except Exception as e:
        logger.error(f"Error finding context: {str(e)}")
        return ""

def calculate_relevance_score(phrase: str, page: Dict) -> float:
    """Calculate relevance score based on phrase presence in title and content."""
    try:
        score = 0.0
        phrase_lower = phrase.lower()
        
        # Check title
        if page.get('title'):
            if phrase_lower in page['title'].lower():
                score += 0.5
                
        # Check content
        if page.get('content'):
            content_lower = page['content'].lower()
            if phrase_lower in content_lower:
                # Calculate frequency
                frequency = content_lower.count(phrase_lower)
                score += min(0.5, frequency * 0.1)  # Cap at 0.5
                
        return min(1.0, score)  # Ensure score doesn't exceed 1.0
        
    except Exception as e:
        logger.error(f"Error calculating relevance: {str(e)}")
        return 0.0