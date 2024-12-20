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
  const usedAnchorTexts = new Set<string>();

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
      // Extract the actual keyword from the format "keyword (density) - context"
      const actualKeyword = keyword.split('(')[0].trim().toLowerCase();
      
      // Skip if we've already used this anchor text
      if (usedAnchorTexts.has(actualKeyword)) {
        logger.info(`Skipping duplicate anchor text: "${actualKeyword}"`);
        continue;
      }

      logger.info(`Processing keyword: "${actualKeyword}"`);
      
      // Find matching pages for this keyword
      const matchingPages = findMatchingPages(actualKeyword, existingPages, usedUrls);
      logger.info(`Found ${matchingPages.length} potential matches for "${actualKeyword}"`);
      
      // Find the best matching page for this keyword
      let bestMatch = null;
      let bestScore = 0;

      for (const page of matchingPages) {
        // Skip if the URL is external (doesn't match the current domain)
        if (!isInternalUrl(page.url)) {
          logger.info(`Skipping external URL: ${page.url}`);
          continue;
        }

        const score = calculateRelevanceScore(actualKeyword, page);
        if (score > bestScore && score > threshold) {
          bestScore = score;
          bestMatch = page;
        }
      }

      if (bestMatch && !usedUrls.has(bestMatch.url)) {
        suggestions.push({
          suggestedAnchorText: keyword.split('(')[0].trim(),
          targetUrl: bestMatch.url,
          targetTitle: bestMatch.title || '',
          context: extractContext(bestMatch.content || '', actualKeyword),
          matchType: matchType,
          relevanceScore: bestScore
        });
        
        // Track used URL and anchor text
        usedUrls.add(bestMatch.url);
        usedAnchorTexts.add(actualKeyword);
        logger.info(`Added suggestion for "${actualKeyword}" -> ${bestMatch.url}`);
      }

      // Break if we have enough suggestions
      if (suggestions.length >= 20) {
        logger.info('Reached maximum suggestion count');
        break;
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
    
    // Skip non-content pages and external URLs
    if (!isInternalUrl(page.url) ||
        page.url.includes('/wp-content/') ||
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

function isInternalUrl(url: string): boolean {
  try {
    // Get the current domain from the URL being analyzed
    const currentDomain = new URL(url).hostname;
    return true; // For now, we'll consider all URLs as internal since we're working with crawled pages
  } catch (error) {
    logger.error(`Error checking if URL is internal: ${error}`);
    return false;
  }
}