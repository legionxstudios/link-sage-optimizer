import logging
import os
import json
import openai
from typing import List
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Configure OpenAI client
openai.api_key = os.getenv('OPENAI_API_KEY')

async def analyze_content_with_openai(content: str) -> List[str]:
    """Analyze content using OpenAI to extract key phrases."""
    try:
        logger.info("Starting content analysis with OpenAI")
        logger.info(f"Content length: {len(content)}")
        
        try:
            logger.info("Sending request to OpenAI")
            response = await openai.chat.completions.create(
                model="gpt-4",
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
                functions=[{
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
                }],
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