from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
import httpx
from typing import List, Dict, Optional
import logging
from modules.content_extractor import extract_content
from modules.keyword_extractor import extract_keywords
from modules.link_suggester import find_keyword_contexts
from modules.data_validator import validate_extracted_data

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ... keep existing code (FastAPI setup and models)

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_page(request: AnalysisRequest):
    """Analyze a webpage and generate both inbound and outbound linking suggestions."""
    try:
        logger.info(f"Starting analysis for URL: {request.url}")
        
        # Fetch and extract content with timeout
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                logger.info(f"Fetching content from URL: {request.url}")
                response = await client.get(str(request.url), follow_redirects=True)
                response.raise_for_status()
                logger.info(f"Successfully fetched content, status code: {response.status_code}")
            except httpx.TimeoutError:
                logger.error("Timeout while fetching URL content")
                raise HTTPException(
                    status_code=504,
                    detail="Timeout while fetching URL content"
                )
            except Exception as e:
                logger.error(f"Error fetching URL: {str(e)}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Error fetching URL: {str(e)}"
                )
        
        # Extract content and validate
        extracted_data = extract_content(response.text, str(request.url))
        validated_data = validate_extracted_data(extracted_data)
        
        if not validated_data:
            logger.error("Failed to validate extracted content")
            raise HTTPException(
                status_code=422,
                detail="Failed to validate extracted content"
            )
        
        logger.info(f"Content validation successful for URL: {request.url}")
        
        # Extract keywords
        main_keywords = extract_keywords(validated_data.content)
        logger.info(f"Extracted keywords: {main_keywords}")
        
        # Calculate link counts
        internal_links_count = len(validated_data.internal_links)
        external_links_count = len(validated_data.external_links)
        logger.info(f"Link counts - Internal: {internal_links_count}, External: {external_links_count}")
        
        # Calculate link score
        link_score = calculate_link_score(internal_links_count, external_links_count)
        logger.info(f"Calculated link score: {link_score}")
        
        # Generate suggestions with proper error handling
        try:
            outbound_suggestions = await find_keyword_contexts(
                validated_data.content,
                main_keywords,
                is_outbound=True
            )
            
            inbound_suggestions = await find_keyword_contexts(
                validated_data.content,
                main_keywords,
                is_outbound=False
            )
            
            logger.info(f"Generated {len(outbound_suggestions)} outbound and {len(inbound_suggestions)} inbound suggestions")
            
        except Exception as e:
            logger.error(f"Error generating suggestions: {str(e)}")
            outbound_suggestions = []
            inbound_suggestions = []
        
        # Create page content object
        page_content = PageContent(
            url=str(request.url),
            title=validated_data.title,
            content=validated_data.content[:1000],  # Truncate content for response
            mainKeywords=main_keywords,
            internalLinksCount=internal_links_count,
            externalLinksCount=external_links_count
        )
        
        return AnalysisResponse(
            pageContents=[page_content],
            outboundSuggestions=outbound_suggestions,
            inboundSuggestions=inbound_suggestions,
            linkScore=link_score
        )
        
    except Exception as e:
        logger.error(f"Error in analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))