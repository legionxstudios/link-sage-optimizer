from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
import logging
from typing import List, Dict, Optional
from modules.content_extractor import extract_content
from modules.keyword_extractor import extract_keywords
from modules.link_suggester import generate_link_suggestions

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalysisRequest(BaseModel):
    url: HttpUrl

class LinkSuggestion(BaseModel):
    suggestedAnchorText: str
    context: str
    matchType: str
    relevanceScore: float

class AnalysisResponse(BaseModel):
    keywords: Dict[str, List[str]]
    outboundSuggestions: List[LinkSuggestion]

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_page(request: AnalysisRequest):
    """Analyze a webpage and generate outbound linking suggestions."""
    try:
        logger.info(f"Starting analysis for URL: {request.url}")
        
        # Extract content
        try:
            extracted_data = extract_content(str(request.url))
            logger.info("Content extraction complete")
            
            if not extracted_data['main_content'].get('content'):
                raise ValueError("No content extracted from the page")
                
        except Exception as e:
            logger.error(f"Content extraction failed: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to extract content: {str(e)}"
            )
        
        # Extract keywords
        try:
            keywords = await extract_keywords(extracted_data['main_content']['content'])
            logger.info("Keyword extraction complete")
            
            if not any(keywords.values()):
                logger.warning("No keywords extracted from content")
                
        except Exception as e:
            logger.error(f"Keyword extraction failed: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to extract keywords: {str(e)}"
            )
        
        # Generate suggestions
        try:
            suggestions = await generate_link_suggestions(
                content=extracted_data['main_content']['content'],
                keywords=keywords,
                existing_links=extracted_data['main_content']['internal_links']
            )
            logger.info("Link suggestions generated")
            
        except Exception as e:
            logger.error(f"Link suggestion generation failed: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate link suggestions: {str(e)}"
            )
        
        response = AnalysisResponse(
            keywords=keywords,
            outboundSuggestions=suggestions['outboundSuggestions']
        )
        
        logger.info("Analysis completed successfully")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in analysis: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred: {str(e)}"
        )