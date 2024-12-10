from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
import httpx
from bs4 import BeautifulSoup
from transformers import pipeline
import asyncio
from typing import List, Dict, Optional
import logging
import re

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

def extract_meaningful_phrases(text: str) -> List[str]:
    """Extract meaningful phrases that could be good anchor text."""
    # Split into sentences
    sentences = re.split(r'[.!?]+', text)
    phrases = []
    
    for sentence in sentences:
        # Look for noun phrases (simplified approach)
        # Match 2-4 word combinations that don't start with common stop words
        words = sentence.strip().split()
        for i in range(len(words) - 1):
            for length in range(2, 5):
                if i + length <= len(words):
                    phrase = ' '.join(words[i:i + length])
                    # Filter out phrases starting with common stop words
                    if not re.match(r'^(the|a|an|and|or|but|in|on|at|to|for|of|with)\s', phrase.lower()):
                        phrases.append(phrase)
    
    return list(set(phrases))  # Remove duplicates

async def crawl_page(url: str) -> Dict:
    """Crawl a single page and extract its content."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove navigation, header, footer, and other non-content elements
            for element in soup.find_all(['nav', 'header', 'footer', 'aside', 'script', 'style']):
                element.decompose()
            
            # Extract title
            title = soup.title.string if soup.title else ""
            
            # Extract main content focusing on article content
            main_content = ""
            content_tags = soup.find_all(['article', 'main', 'div'], class_=['content', 'main-content', 'post-content', 'entry-content'])
            
            if content_tags:
                main_content = " ".join([tag.get_text(strip=True) for tag in content_tags])
            else:
                # Fallback to paragraph text if no main content areas found
                paragraphs = []
                for p in soup.find_all('p'):
                    # Filter out short paragraphs and likely navigation text
                    text = p.get_text(strip=True)
                    if len(text) > 50 and not any(nav_term in text.lower() for nav_term in ['menu', 'navigation', 'copyright', 'all rights reserved']):
                        paragraphs.append(text)
                main_content = " ".join(paragraphs)
            
            # Extract potential anchor phrases
            potential_anchors = extract_meaningful_phrases(main_content)
            
            logger.info(f"Extracted {len(potential_anchors)} potential anchor phrases")
            
            return {
                'title': title,
                'content': main_content,
                'potential_anchors': potential_anchors
            }
    except Exception as e:
        logger.error(f"Error crawling {url}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error crawling page: {str(e)}")

async def analyze_content(content: str) -> List[str]:
    """Analyze content using the zero-shot classifier to identify main topics."""
    try:
        # Define more specific and relevant categories for classification
        candidate_keywords = [
            "photography", "cameras", "wedding planning", "events",
            "film photography", "digital photography", "camera equipment",
            "photo tips", "photography gear", "camera reviews"
        ]
        
        # Split content into chunks if it's too long
        max_length = 1024
        content_chunks = [content[i:i + max_length] for i in range(0, len(content), max_length)]
        
        all_keywords = set()
        for chunk in content_chunks:
            result = classifier(chunk, candidate_keywords, multi_label=True)
            # Filter keywords with confidence > 0.3
            keywords = [label for label, score in zip(result['labels'], result['scores']) if score > 0.3]
            all_keywords.update(keywords)
        
        logger.info(f"Identified main keywords: {all_keywords}")
        return list(all_keywords)
    except Exception as e:
        logger.error(f"Error analyzing content: {str(e)}")
        return []

def generate_link_suggestions(content: str, potential_anchors: List[str], main_keywords: List[str]) -> List[LinkSuggestion]:
    """Generate internal linking suggestions based on content analysis."""
    suggestions = []
    paragraphs = re.split(r'\n+', content)
    
    for anchor in potential_anchors:
        # Skip very short or very long anchor texts
        if len(anchor.split()) < 2 or len(anchor.split()) > 4:
            continue
            
        # Find relevant paragraphs that could contain this anchor
        for paragraph in paragraphs:
            if len(paragraph) < 50:  # Skip very short paragraphs
                continue
                
            # Check if the paragraph is relevant to our main keywords
            if not any(keyword.lower() in paragraph.lower() for keyword in main_keywords):
                continue
                
            # If the anchor text appears naturally in the paragraph, skip it
            if anchor.lower() in paragraph.lower():
                continue
                
            # Generate suggestion with context
            context = paragraph[:200] + "... [Suggested placement for '" + anchor + "'] ..." + paragraph[-200:]
            
            suggestion = LinkSuggestion(
                sourceUrl="/suggested-article",  # This would be replaced with actual related article URL
                targetUrl="/target-article",     # This would be replaced with actual target article URL
                suggestedAnchorText=anchor,
                relevanceScore=0.75,  # This would be calculated based on semantic similarity
                context=context
            )
            suggestions.append(suggestion)
    
    return suggestions[:5]  # Limit to top 5 suggestions

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_page(request: AnalysisRequest):
    """Analyze a webpage and generate internal linking suggestions."""
    try:
        # Crawl the target page
        page_data = await crawl_page(str(request.url))
        
        # Analyze the content
        main_keywords = await analyze_content(page_data['content'])
        
        # Generate link suggestions
        suggestions = generate_link_suggestions(
            page_data['content'],
            page_data['potential_anchors'],
            main_keywords
        )
        
        # Create page content object
        page_content = PageContent(
            url=str(request.url),
            title=page_data['title'],
            content=page_data['content'][:1000],  # First 1000 chars for response
            mainKeywords=main_keywords
        )
        
        logger.info(f"Analysis complete. Found {len(suggestions)} suggestions")
        
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