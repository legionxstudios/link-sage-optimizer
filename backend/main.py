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

# Configure CORS
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
    source_url: str
    target_url: str
    suggested_anchor_text: str
    context: str
    match_type: str
    relevance_score: float

class PageContent(BaseModel):
    url: str
    title: str
    content: str
    mainKeywords: Dict[str, List[str]]
    internalLinksCount: int
    externalLinksCount: int

class AnalysisResponse(BaseModel):
    pageContents: List[PageContent]
    outboundSuggestions: List[LinkSuggestion]
    inboundSuggestions: List[LinkSuggestion]
    linkScore: float

def calculate_link_score(inbound_count: int, outbound_count: int) -> float:
    """Calculate a link health score from 0-5."""
    # Base score
    score = 2.5
    
    # Add points for having both inbound and outbound links
    if inbound_count > 0 and outbound_count > 0:
        score += 1
    
    # Add points for good number of inbound links (3-10 is ideal)
    if 3 <= inbound_count <= 10:
        score += 0.75
    elif inbound_count > 10:
        score += 0.5
    
    # Add points for good number of outbound links (2-5 is ideal)
    if 2 <= outbound_count <= 5:
        score += 0.75
    elif outbound_count > 5:
        score += 0.25
    
    # Cap score at 5
    return min(5.0, score)

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_page(request: AnalysisRequest):
    """Analyze a webpage and generate both inbound and outbound linking suggestions."""
    try:
        logger.info(f"Starting analysis for URL: {request.url}")
        
        # Step 1: Extract content and analyze site structure
        extracted_data = extract_content(str(request.url))
        logger.info("Content extraction complete")
        
        # Step 2: Extract keywords from content
        keywords = extract_keywords(extracted_data['main_content']['content'])
        logger.info("Keyword extraction complete")
        
        # Step 3: Generate link suggestions
        suggestions = await generate_link_suggestions(
            content=extracted_data['main_content']['content'],
            keywords=keywords,
            existing_links=extracted_data['main_content']['internal_links'],
            inbound_links=extracted_data['inbound_links'],
            outbound_links=extracted_data['outbound_links']
        )
        logger.info("Link suggestions generated")
        
        # Calculate metrics
        inbound_count = len(extracted_data['inbound_links'])
        outbound_count = len(extracted_data['main_content']['internal_links'])
        link_score = calculate_link_score(inbound_count, outbound_count)
        
        # Create response
        page_content = PageContent(
            url=str(request.url),
            title=extracted_data['main_content']['title'],
            content=extracted_data['main_content']['content'][:1000],  # Truncate for response
            mainKeywords=keywords,
            internalLinksCount=outbound_count,
            externalLinksCount=len(extracted_data['main_content']['external_links'])
        )
        
        response = AnalysisResponse(
            pageContents=[page_content],
            outboundSuggestions=suggestions['outbound_suggestions'],
            inboundSuggestions=suggestions['inbound_suggestions'],
            linkScore=link_score
        )
        
        logger.info("Analysis complete")
        return response
        
    except Exception as e:
        logger.error(f"Error in analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))