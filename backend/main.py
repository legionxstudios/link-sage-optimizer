from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
import httpx
from typing import List, Dict, Optional
import logging
from modules.content_extractor import extract_content
from modules.keyword_extractor import extract_keywords
from modules.link_suggester import find_keyword_contexts

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

class PageContent(BaseModel):
    url: str
    title: str
    content: str
    mainKeywords: List[str]
    internalLinksCount: int
    externalLinksCount: int

class LinkSuggestion(BaseModel):
    sourceUrl: str
    targetUrl: str
    suggestedAnchorText: str
    matchType: str
    relevanceScore: float
    context: str

class AnalysisResponse(BaseModel):
    pageContents: List[PageContent]
    outboundSuggestions: List[LinkSuggestion]
    inboundSuggestions: List[LinkSuggestion]
    linkScore: float

def calculate_link_score(internal_links: int, external_links: int) -> float:
    """Calculate a score based on the number and balance of links."""
    total_links = internal_links + external_links
    if total_links == 0:
        return 0.0
    
    # Base score from total number of links (max 5 points)
    base_score = min(5, total_links / 4)
    
    # Balance score - reward having both internal and external links
    balance_score = 0
    if internal_links > 0 and external_links > 0:
        ratio = min(internal_links, external_links) / max(internal_links, external_links)
        balance_score = ratio * 2  # Max 2 points for perfect balance
    
    # Combine scores (max 7 points, normalize to 0-5 range)
    total_score = (base_score + balance_score) * (5/7)
    return round(total_score, 2)

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_page(request: AnalysisRequest):
    """Analyze a webpage and generate both inbound and outbound linking suggestions."""
    try:
        logger.info(f"Starting analysis for URL: {request.url}")
        
        # Fetch and extract content
        async with httpx.AsyncClient() as client:
            response = await client.get(str(request.url))
            response.raise_for_status()
        
        # Extract content and analyze links
        extracted_data = extract_content(response.text, str(request.url))
        logger.info(f"Extracted data: {extracted_data}")
        
        # Extract keywords
        main_keywords = extract_keywords(extracted_data['content'])
        logger.info(f"Extracted keywords: {main_keywords}")
        
        # Calculate link counts
        internal_links_count = len(extracted_data['internal_links'])
        external_links_count = len(extracted_data['external_links'])
        logger.info(f"Link counts - Internal: {internal_links_count}, External: {external_links_count}")
        
        # Calculate link score
        link_score = calculate_link_score(internal_links_count, external_links_count)
        logger.info(f"Calculated link score: {link_score}")
        
        # Generate suggestions
        outbound_suggestions = find_keyword_contexts(
            extracted_data['content'],
            main_keywords,
            is_outbound=True
        )
        
        inbound_suggestions = find_keyword_contexts(
            extracted_data['content'],
            main_keywords,
            is_outbound=False
        )
        
        logger.info(f"Generated {len(outbound_suggestions)} outbound and {len(inbound_suggestions)} inbound suggestions")
        
        # Create page content object
        page_content = PageContent(
            url=str(request.url),
            title=extracted_data['title'],
            content=extracted_data['content'][:1000],  # Truncate content for response
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)