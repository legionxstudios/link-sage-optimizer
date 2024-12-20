import { ExistingPage } from "./types.ts";
import { logger } from "./logger.ts";

export function generateSuggestions(
  keywords: { [key: string]: string[] },
  existingPages: ExistingPage[]
) {
  logger.info('Starting suggestion generation with keywords:', keywords);
  logger.info(`Working with ${existingPages.length} existing pages`);

  const suggestions = [];
  const usedUrls = new Set<string>();

  // Process each keyword type with different relevance thresholds
  const keywordTypes = {
    exact_match: 0.2,  // Lowered threshold to ensure we get suggestions
    broad_match: 0.15,
    related_match: 0.1
  };

  // Process each keyword type
  for (const [matchType, threshold] of Object.entries(keywordTypes)) {
    const keywordList = keywords[matchType as keyof typeof keywords] || [];
    logger.info(`Processing ${keywordList.length} ${matchType} keywords with threshold ${threshold}`);

    for (const keyword of keywordList) {
      // Extract the actual keyword from the format "keyword (density) - context"
      const actualKeyword = keyword.split('(')[0].trim();
      logger.info(`Processing keyword: "${actualKeyword}"`);
      
      // Find matching pages for this keyword
      const matchingPages = findMatchingPages(actualKeyword, existingPages, usedUrls);
      logger.info(`Found ${matchingPages.length} potential matches for "${actualKeyword}"`);
      
      for (const matchingPage of matchingPages) {
        if (suggestions.length >= 20) break; // Increased limit from 10 to 20
        
        const relevanceScore = calculateRelevanceScore(actualKeyword, matchingPage);
        logger.info(`Relevance score for "${actualKeyword}" -> ${matchingPage.url}: ${relevanceScore}`);

        if (relevanceScore > threshold) { // Using dynamic threshold based on match type
          suggestions.push({
            suggestedAnchorText: actualKeyword,
            targetUrl: matchingPage.url,
            targetTitle: matchingPage.title || '',
            context: extractContext(matchingPage.content || '', actualKeyword),
            matchType: matchType,
            relevanceScore: relevanceScore
          });
          
          // Track used URL to avoid duplicates
          usedUrls.add(matchingPage.url);
          logger.info(`Added suggestion for "${actualKeyword}" -> ${matchingPage.url}`);
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
    
    // Check if keyword appears in URL slug
    const urlSlug = new URL(page.url).pathname.toLowerCase();
    if (urlSlug.includes(keywordLower.replace(/\s+/g, '-'))) {
      return true;
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
  
  // Check URL slug (highest weight)
  const urlSlug = new URL(page.url).pathname.toLowerCase();
  if (urlSlug.includes(keywordLower.replace(/\s+/g, '-'))) {
    score += 0.4;
  }
  
  // Check title (medium weight)
  if (page.title?.toLowerCase().includes(keywordLower)) {
    score += 0.3;
  }
  
  // Check content (lower weight)
  if (page.content?.toLowerCase().includes(keywordLower)) {
    const frequency = (page.content.toLowerCase().match(new RegExp(keywordLower, 'g')) || []).length;
    score += Math.min(0.3, frequency * 0.05); // Cap content score at 0.3
  }
  
  return Math.min(1.0, score);
}

function extractContext(content: string, keyword: string): string {
  const keywordLower = keyword.toLowerCase();
  const contentLower = content.toLowerCase();
  const keywordIndex = contentLower.indexOf(keywordLower);
  
  if (keywordIndex === -1) return "";
  
  const start = Math.max(0, keywordIndex - 100);
  const end = Math.min(content.length, keywordIndex + keyword.length + 100);
  let context = content.slice(start, end).trim();
  
  // Highlight the keyword in the context
  const regex = new RegExp(keyword, 'gi');
  context = context.replace(regex, `[${keyword}]`);
  
  return context;
}