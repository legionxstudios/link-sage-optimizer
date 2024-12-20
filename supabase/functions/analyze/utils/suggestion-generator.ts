import { ExistingPage } from "./types.ts";
import { logger } from "./logger.ts";

export function generateSuggestions(
  keywords: { [key: string]: string[] },
  existingPages: ExistingPage[]
) {
  logger.info('Starting suggestion generation with keywords:', keywords);
  logger.info(`Working with ${existingPages.length} existing pages`);
  logger.debug('First few existing pages:', existingPages.slice(0, 3));

  const suggestions = [];
  const usedUrls = new Set<string>();

  // Process each keyword type
  for (const [matchType, keywordList] of Object.entries(keywords)) {
    logger.info(`Processing ${keywordList.length} ${matchType} keywords`);

    for (const keyword of keywordList) {
      logger.info(`Analyzing keyword: "${keyword}"`);
      
      // Find best matching page for this keyword
      const matchingPages = findMatchingPages(keyword, existingPages, usedUrls);
      logger.info(`Found ${matchingPages.length} potential matches for "${keyword}"`);
      
      for (const matchingPage of matchingPages) {
        if (suggestions.length >= 10) break; // Limit to top 10 suggestions
        
        const relevanceScore = calculateRelevanceScore(keyword, matchingPage);
        logger.info(`Relevance score for "${keyword}" -> ${matchingPage.url}: ${relevanceScore}`);

        if (relevanceScore > 0.3) { // Lowered threshold from 0.5 to 0.3
          suggestions.push({
            suggestedAnchorText: keyword,
            targetUrl: matchingPage.url,
            targetTitle: matchingPage.title || '',
            context: `Content contains "${keyword}" which is relevant to the target page about ${matchingPage.title}`,
            matchType: matchType,
            relevanceScore
          });
          
          // Track used URL to avoid duplicates
          usedUrls.add(matchingPage.url);
          logger.info(`Added suggestion for "${keyword}" -> ${matchingPage.url}`);
        }
      }
    }
  }

  logger.info(`Generated ${suggestions.length} total suggestions`);
  logger.debug('Final suggestions:', suggestions);
  return suggestions;
}

function findMatchingPages(
  keyword: string, 
  existingPages: ExistingPage[], 
  usedUrls: Set<string>
): ExistingPage[] {
  const keywordLower = keyword.toLowerCase();
  
  return existingPages.filter(page => {
    // Skip already used URLs and invalid pages
    if (!page.url || usedUrls.has(page.url)) return false;
    
    // Skip non-content pages
    if (page.url.includes('/wp-content/') ||
        page.url.includes('/cart') ||
        page.url.includes('/checkout') ||
        page.url.includes('/my-account') ||
        page.url.match(/\.(jpg|jpeg|png|gif|css|js)$/)) {
      return false;
    }
    
    // Check if keyword appears in title or content
    const titleMatch = page.title?.toLowerCase().includes(keywordLower);
    const contentMatch = page.content?.toLowerCase().includes(keywordLower);
    
    return titleMatch || contentMatch;
  });
}

function calculateRelevanceScore(keyword: string, page: ExistingPage): number {
  let score = 0;
  const keywordLower = keyword.toLowerCase();
  
  // Check title (higher weight for title matches)
  if (page.title?.toLowerCase().includes(keywordLower)) {
    score += 0.6;
  }
  
  // Check content
  if (page.content?.toLowerCase().includes(keywordLower)) {
    const frequency = (page.content.toLowerCase().match(new RegExp(keywordLower, 'g')) || []).length;
    score += Math.min(0.4, frequency * 0.1); // Cap content score at 0.4
  }
  
  return Math.min(1.0, score);
}