from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
import httpx
from bs4 import BeautifulSoup
from transformers import pipeline
import asyncio
from typing import List, Dict, Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the zero-shot classification pipeline
classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

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

async def crawl_page(url: str) -> Dict:
    """Crawl a single page and extract its content."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Extract title and main content
            title = soup.title.string if soup.title else ""
            
            # Extract main content (focusing on article/main content areas)
            main_content = ""
            content_tags = soup.find_all(['article', 'main', 'div'], class_=['content', 'main-content', 'post-content'])
            if content_tags:
                main_content = " ".join([tag.get_text(strip=True) for tag in content_tags])
            else:
                # Fallback to paragraph text if no main content areas found
                main_content = " ".join([p.get_text(strip=True) for p in soup.find_all('p')])
            
            # Find all internal links
            internal_links = []
            base_domain = url.split('/')[2]
            for link in soup.find_all('a', href=True):
                href = link.get('href')
                if base_domain in href or href.startswith('/'):
                    internal_links.append({
                        'url': href if href.startswith('http') else f"https://{base_domain}{href}",
                        'text': link.get_text(strip=True)
                    })
            
            return {
                'title': title,
                'content': main_content,
                'internal_links': internal_links
            }
    except Exception as e:
        logger.error(f"Error crawling {url}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error crawling page: {str(e)}")

async def analyze_content(content: str, target_url: str) -> List[str]:
    """Analyze content using the zero-shot classifier to identify main keywords."""
    try:
        # Predefined categories for classification
        candidate_keywords = [
            "technology", "business", "health", "education", "entertainment",
            "sports", "science", "politics", "lifestyle", "travel"
        ]
        
        result = classifier(content, candidate_keywords, multi_label=True)
        
        # Filter keywords with confidence > 0.3
        main_keywords = [label for label, score in zip(result['labels'], result['scores']) if score > 0.3]
        return main_keywords
    except Exception as e:
        logger.error(f"Error analyzing content: {str(e)}")
        return []

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_page(request: AnalysisRequest):
    """Analyze a webpage and generate internal linking suggestions."""
    try:
        # Crawl the target page
        page_data = await crawl_page(str(request.url))
        
        # Analyze the content
        main_keywords = await analyze_content(page_data['content'], str(request.url))
        
        # Create page content object
        page_content = PageContent(
            url=str(request.url),
            title=page_data['title'],
            content=page_data['content'][:500],  # Truncate content for response
            mainKeywords=main_keywords
        )
        
        # Generate link suggestions based on internal links and content analysis
        suggestions = []
        for link in page_data['internal_links']:
            # Calculate relevance score based on keyword matching
            relevance_score = 0.75  # Default score, should be calculated based on actual content relevance
            
            suggestion = LinkSuggestion(
                sourceUrl=link['url'],
                targetUrl=str(request.url),
                suggestedAnchorText=link['text'],
                relevanceScore=relevance_score,
                context=f"Found in page content near: {link['text']}"
            )
            suggestions.append(suggestion)
        
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