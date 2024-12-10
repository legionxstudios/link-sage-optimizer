from typing import Dict, List, Optional
from pydantic import BaseModel, HttpUrl, validator
import logging

logger = logging.getLogger(__name__)

class ExtractedLink(BaseModel):
    url: HttpUrl
    text: Optional[str] = None
    is_internal: bool = False

class ValidatedContent(BaseModel):
    url: HttpUrl
    title: str
    content: str
    internal_links: List[ExtractedLink]
    external_links: List[ExtractedLink]
    
    @validator('title')
    def title_not_empty(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Title cannot be empty')
        return v.strip()
    
    @validator('content')
    def content_not_empty(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Content cannot be empty')
        return v.strip()
    
    @validator('internal_links', 'external_links')
    def validate_links(cls, links):
        valid_links = []
        for link in links:
            try:
                if isinstance(link, dict):
                    valid_links.append(ExtractedLink(**link))
                else:
                    valid_links.append(link)
            except Exception as e:
                logger.warning(f"Skipping invalid link: {link}. Error: {str(e)}")
        return valid_links

def validate_extracted_data(data: Dict) -> Optional[ValidatedContent]:
    """
    Validates extracted data before insertion into Supabase.
    Returns None if validation fails.
    """
    try:
        logger.info(f"Validating extracted data for URL: {data.get('url')}")
        
        validated_data = ValidatedContent(
            url=data['url'],
            title=data['title'],
            content=data['content'],
            internal_links=[
                ExtractedLink(url=link, is_internal=True)
                for link in data.get('internal_links', [])
            ],
            external_links=[
                ExtractedLink(url=link, is_internal=False)
                for link in data.get('external_links', [])
            ]
        )
        
        logger.info(
            f"Validation successful. Found {len(validated_data.internal_links)} internal "
            f"and {len(validated_data.external_links)} external links"
        )
        return validated_data
        
    except Exception as e:
        logger.error(f"Validation failed: {str(e)}")
        return None