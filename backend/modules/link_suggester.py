import logging
from typing import List, Dict, Any
import httpx
import os
from dotenv import load_dotenv
import asyncio
from collections import defaultdict

load_dotenv()
logger = logging.getLogger(__name__)

class LinkSuggester:
    def __init__(self, content: str, keywords: Dict[str, List[str]], existing_links: List[Dict]):
        self.content = content
        self.keywords = keywords
        self.existing_links = existing_links
        self.existing_urls = {link['url'] for link in existing_links}

    async def generate_suggestions(self, inbound_links: List[Dict], outbound_links: List[Dict]) -> Dict[str, List[Dict]]:
        """Generate both inbound and outbound link suggestions."""
        try:
            # Process in parallel
            inbound_task = asyncio.create_task(self._generate_inbound_suggestions(inbound_links))
            outbound_task = asyncio.create_task(self._generate_outbound_suggestions(outbound_links))
            
            inbound_suggestions, outbound_suggestions = await asyncio.gather(
                inbound_task,
                outbound_task
            )
            
            return {
                'inbound_suggestions': inbound_suggestions,
                'outbound_suggestions': outbound_suggestions
            }
        except Exception as e:
            logger.error(f"Error generating suggestions: {str(e)}")
            raise

    async def _generate_inbound_suggestions(self, existing_inbound: List[Dict]) -> List[Dict]:
        """Generate suggestions for pages that should link to this content."""
        suggestions = []
        existing_sources = {link.get('source_url') for link in existing_inbound}
        
        # Group keywords by match type
        for match_type, keywords in self.keywords.items():
            relevance_multiplier = {
                'exact_match': 1.0,
                'broad_match': 0.8,
                'related_match': 0.6
            }.get(match_type, 0.5)
            
            for keyword in keywords:
                # Find relevant contexts for this keyword
                contexts = self._find_keyword_contexts(keyword)
                
                for context in contexts:
                    # Skip if we already have a link from this source
                    if context['source_url'] in existing_sources:
                        continue
                    
                    suggestions.append({
                        'source_url': context['source_url'],
                        'target_url': context['target_url'],
                        'suggested_anchor_text': keyword,
                        'context': context['context'],
                        'match_type': match_type,
                        'relevance_score': context['relevance'] * relevance_multiplier
                    })
        
        # Sort by relevance score and take top suggestions
        return sorted(suggestions, key=lambda x: x['relevance_score'], reverse=True)[:10]

    async def _generate_outbound_suggestions(self, existing_outbound: List[Dict]) -> List[Dict]:
        """Generate suggestions for pages this content should link to."""
        suggestions = []
        
        # Group keywords by match type
        for match_type, keywords in self.keywords.items():
            relevance_multiplier = {
                'exact_match': 1.0,
                'broad_match': 0.8,
                'related_match': 0.6
            }.get(match_type, 0.5)
            
            for keyword in keywords:
                # Find sentences containing the keyword
                sentences = [s.strip() for s in self.content.split('.') if keyword.lower() in s.lower()]
                
                if not sentences:
                    continue
                
                try:
                    # Use Hugging Face API to validate relevance
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        response = await client.post(
                            "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
                            headers={"Authorization": f"Bearer {os.getenv('HUGGING_FACE_API_KEY')}"},
                            json={
                                "inputs": sentences[0],
                                "parameters": {"candidate_labels": [keyword]},
                            }
                        )
                        
                        scores = response.json().get("scores", [])
                        
                        if scores and scores[0] > 0.3:  # Relevance threshold
                            suggestions.append({
                                'source_url': '',  # Will be filled by the caller
                                'target_url': '',  # Will be filled based on site structure
                                'suggested_anchor_text': keyword,
                                'context': sentences[0],
                                'match_type': match_type,
                                'relevance_score': scores[0] * relevance_multiplier
                            })
                            
                except Exception as e:
                    logger.error(f"Error processing keyword {keyword}: {str(e)}")
                    continue
                
                # Small delay to respect API rate limits
                await asyncio.sleep(0.1)
        
        # Sort by relevance score and take top suggestions
        return sorted(suggestions, key=lambda x: x['relevance_score'], reverse=True)[:10]

    def _find_keyword_contexts(self, keyword: str) -> List[Dict]:
        """Find contexts where a keyword appears in the content."""
        contexts = []
        sentences = self.content.split('.')
        
        for sentence in sentences:
            if keyword.lower() in sentence.lower():
                # Calculate a simple relevance score based on keyword position and sentence length
                position_score = 1.0 if sentence.lower().startswith(keyword.lower()) else 0.7
                length_score = min(1.0, 100 / len(sentence)) if len(sentence) > 0 else 0.5
                
                contexts.append({
                    'source_url': '',  # Will be filled by the caller
                    'target_url': '',  # Will be filled by the caller
                    'context': sentence.strip(),
                    'relevance': position_score * length_score
                })
        
        return contexts

async def generate_link_suggestions(
    content: str,
    keywords: Dict[str, List[str]],
    existing_links: List[Dict],
    inbound_links: List[Dict],
    outbound_links: List[Dict]
) -> Dict[str, List[Dict]]:
    """Main function to generate link suggestions."""
    try:
        suggester = LinkSuggester(content, keywords, existing_links)
        return await suggester.generate_suggestions(inbound_links, outbound_links)
    except Exception as e:
        logger.error(f"Error in link suggestion generation: {str(e)}")
        raise