from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
import logging
from typing import List, Dict, Optional
from modules.content_extractor import extract_content
from modules.keyword_extractor import extract_keywords
from modules.link_suggester import generate_link_suggestions

logging.basicConfig(level=logging.INFO)
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
        extracted_data = extract_content(str(request.url))
        logger.info("Content extraction complete")
        
        # Extract keywords
        keywords = extract_keywords(extracted_data['main_content']['content'])
        logger.info("Keyword extraction complete")
        
        # Generate suggestions
        suggestions = await generate_link_suggestions(
            content=extracted_data['main_content']['content'],
            keywords=keywords,
            existing_links=extracted_data['main_content']['internal_links']
        )
        logger.info("Link suggestions generated")
        
        return AnalysisResponse(
            keywords=keywords,
            outboundSuggestions=suggestions['outboundSuggestions']
        )
        
    except Exception as e:
        logger.error(f"Error in analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))