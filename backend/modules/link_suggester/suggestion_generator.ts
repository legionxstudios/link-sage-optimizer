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
  const usedKeywords = new Set<string>();

  // Process each keyword type with different relevance thresholds
  const keywordTypes = {
    exact_match: 0.2,
    broad_match: 0.15,
    related_match: 0.1
  };

  // Process each keyword type
  for (const [matchType, threshold] of Object.entries(keywordTypes)) {
    const keywordList = keywords[matchType as keyof typeof keywords] || [];
    logger.info(`Processing ${keywordList.length} ${matchType} keywords with threshold ${threshold}`);

    for (const keyword of keywordList) {
      // Skip if we've already used this keyword
      const actualKeyword = keyword.split('(')[0].trim().toLowerCase();
      if (usedKeywords.has(actualKeyword)) {
        logger.info(`Skipping already used keyword: "${actualKeyword}"`);
        continue;
      }

      logger.info(`Processing keyword: "${actualKeyword}"`);
      
      // Find matching pages for this keyword
      const matchingPages = findMatchingPages(actualKeyword, existingPages, usedUrls);
      logger.info(`Found ${matchingPages.length} potential matches for "${actualKeyword}"`);
      
      // Get the best matching page for this keyword
      const bestMatch = findBestMatchingPage(actualKeyword, matchingPages);
      
      if (bestMatch && bestMatch.relevanceScore > threshold) {
        suggestions.push({
          suggestedAnchorText: actualKeyword,
          targetUrl: bestMatch.page.url,
          targetTitle: bestMatch.page.title || '',
          context: extractContext(bestMatch.page.content || '', actualKeyword),
          matchType: matchType,
          relevanceScore: bestMatch.relevanceScore
        });
        
        // Track used keyword and URL
        usedKeywords.add(actualKeyword);
        usedUrls.add(bestMatch.page.url);
        logger.info(`Added suggestion for "${actualKeyword}" -> ${bestMatch.page.url}`);
        
        // Break if we have enough diverse suggestions
        if (suggestions.length >= 10) {
          logger.info('Reached maximum suggestion count');
          break;
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

function findBestMatchingPage(keyword: string, pages: ExistingPage[]): { page: ExistingPage, relevanceScore: number } | null {
  if (pages.length === 0) return null;
  
  const scoredPages = pages.map(page => ({
    page,
    relevanceScore: calculateRelevanceScore(keyword, page)
  }));
  
  // Sort by score descending
  scoredPages.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  return scoredPages[0];
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