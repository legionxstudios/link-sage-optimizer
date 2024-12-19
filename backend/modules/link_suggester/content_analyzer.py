import logging
import json
import os
import openai
from typing import List, Dict, Any
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Configure OpenAI client
openai.api_key = os.getenv('OPENAI_API_KEY')

async def analyze_content(content: str) -> List[str]:
    """Analyze content using OpenAI to extract ONLY phrases that exist in the content."""
    try:
        logger.info("Starting content analysis with OpenAI")
        logger.info(f"Content length: {len(content)}")
        
        function_definition = {
            "name": "extract_key_phrases",
            "description": "Extract ONLY 2-3 word phrases that EXIST VERBATIM in the content. Each phrase must appear exactly as written.",
            "parameters": {
                "type": "object",
                "properties": {
                    "key_phrases": {
                        "type": "array",
                        "items": {
                            "type": "string",
                            "description": "A 2-3 word phrase that exists exactly in the content"
                        },
                        "description": "List of 2-3 word phrases that appear verbatim in the text"
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
                        "content": """You are an expert at identifying key phrases for SEO interlinking.
                        CRITICAL RULES:
                        1. ONLY return phrases that exist VERBATIM in the content
                        2. Each phrase must be EXACTLY 2-3 words
                        3. Verify each phrase appears exactly as written
                        4. Do not modify or paraphrase any phrases
                        5. Do not combine words that aren't already together in the text"""
                    },
                    {
                        "role": "user",
                        "content": f"""Extract ONLY 2-3 word phrases that appear EXACTLY in this content. 
                        Return ONLY phrases that exist VERBATIM in the text.
                        Do not modify or combine words.
                        Content:\n\n{content[:2000]}"""
                    }
                ],
                functions=[function_definition],
                function_call={"name": "extract_key_phrases"},
                temperature=0.3
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
                
                # Verify each phrase exists in content
                verified_phrases = []
                content_lower = content.lower()
                
                for phrase in key_phrases:
                    # Skip phrases that aren't 2-3 words
                    if not 2 <= len(phrase.split()) <= 3:
                        continue
                        
                    # Check if phrase exists exactly in content
                    phrase_lower = phrase.lower()
                    if f" {phrase_lower} " in f" {content_lower} ":
                        verified_phrases.append(phrase)
                        logger.info(f"Verified phrase found in content: {phrase}")
                    else:
                        logger.warning(f"Phrase not found in content: {phrase}")
                
                logger.info(f"Extracted {len(verified_phrases)} verified phrases")
                return verified_phrases
                
            except Exception as e:
                logger.error(f"Error parsing OpenAI response: {str(e)}")
                return []
                
        except Exception as e:
            logger.error(f"OpenAI API error: {str(e)}")
            return []
            
    except Exception as e:
        logger.error(f"Error in content analysis: {str(e)}", exc_info=True)
        return []