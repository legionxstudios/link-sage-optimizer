from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
import httpx
from typing import List, Dict, Optional
import logging
from modules.content_extractor import extract_content
from modules.keyword_extractor import extract_keywords
from modules.link_suggester import find_keyword_contexts

# Configure logging
logging.basicConfig(level=logging.INFO)
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

class PageContent(BaseModel):
    url: str
    title: str
    content: str
    mainKeywords: List[str]

class LinkSuggestion(BaseModel):
    sourceUrl: str
    targetUrl: str
    suggestedAnchorText: str
    relevanceScore: float
    context: str

class AnalysisResponse(BaseModel):
    pageContents: List[PageContent]
    suggestions: List[LinkSuggestion]

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_page(request: AnalysisRequest):
    """Analyze a webpage and generate internal linking suggestions."""
    try:
        # Fetch and extract content
        async with httpx.AsyncClient() as client:
            response = await client.get(str(request.url))
            response.raise_for_status()
            
        # Extract content
        extracted_data = extract_content(response.text)
        
        # Extract keywords
        main_keywords = extract_keywords(extracted_data['content'])
        logger.info(f"Extracted keywords: {main_keywords}")
        
        # Generate suggestions
        suggestions = find_keyword_contexts(extracted_data['content'], main_keywords)
        logger.info(f"Generated {len(suggestions)} suggestions")
        
        # Create page content object
        page_content = PageContent(
            url=str(request.url),
            title=extracted_data['title'],
            content=extracted_data['content'][:1000],
            mainKeywords=main_keywords
        )
        
        return AnalysisResponse(
            pageContents=[page_content],
            suggestions=suggestions
        )
    except Exception as e:
        logger.error(f"Error in analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)