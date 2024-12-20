import { ExistingPage } from "./types.ts";
import { logger } from "./logger.ts";
import { calculateRelevanceScore } from "./scoring/relevance-calculator.ts";

export function generateSuggestions(
  keywords: { [key: string]: string[] },
  existingPages: ExistingPage[]
) {
  logger.info('Starting suggestion generation with keywords:', keywords);
  logger.info(`Working with ${existingPages.length} existing pages`);

  const suggestions = [];
  const usedUrls = new Set<string>();
  const usedAnchorTexts = new Set<string>();

  // Get all valid domains that should be considered internal
  const internalDomains = new Set(['legionxstudios.com', 'www.legionxstudios.com']);
  logger.info(`Using internal domains:`, Array.from(internalDomains));

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
      const actualKeyword = keyword.split('(')[0].trim().toLowerCase();
      
      if (usedAnchorTexts.has(actualKeyword)) {
        logger.info(`Skipping duplicate anchor text: "${actualKeyword}"`);
        continue;
      }

      logger.info(`Processing keyword: "${actualKeyword}"`);
      
      // Find matching pages for this keyword
      const matchingPages = findMatchingPages(actualKeyword, existingPages, usedUrls, internalDomains);
      logger.info(`Found ${matchingPages.length} potential matches for "${actualKeyword}"`);
      
      // Find the best matching page for this keyword
      let bestMatch = null;
      let bestScore = 0;

      for (const page of matchingPages) {
        if (!isInternalUrl(page.url, internalDomains)) {
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
        
        usedUrls.add(bestMatch.url);
        usedAnchorTexts.add(actualKeyword);
        logger.info(`Added suggestion for "${actualKeyword}" -> ${bestMatch.url} (score: ${bestScore})`);
      }

      if (suggestions.length >= 20) {
        logger.info('Reached maximum suggestion count');
        break;
      }
    }
  }

  logger.info(`Generated ${suggestions.length} total suggestions`);
  return suggestions;
}

function findMatchingPages(
  keyword: string, 
  existingPages: ExistingPage[], 
  usedUrls: Set<string>,
  internalDomains: Set<string>
): ExistingPage[] {
  const keywordLower = keyword.toLowerCase();
  
  return existingPages.filter(page => {
    if (!page.url || usedUrls.has(page.url)) return false;
    
    if (!isInternalUrl(page.url, internalDomains) ||
        page.url.includes('/wp-content/') ||
        page.url.includes('/cart') ||
        page.url.includes('/checkout') ||
        page.url.includes('/my-account') ||
        page.url.match(/\.(jpg|jpeg|png|gif|css|js)$/)) {
      return false;
    }
    
    const urlSlug = new URL(page.url).pathname.toLowerCase();
    if (urlSlug.includes(keywordLower.replace(/\s+/g, '-'))) {
      return true;
    }
    
    return page.title?.toLowerCase().includes(keywordLower) ||
           page.content?.toLowerCase().includes(keywordLower);
  });
}

function extractContext(content: string, keyword: string): string {
  const keywordLower = keyword.toLowerCase();
  const contentLower = content.toLowerCase();
  const keywordIndex = contentLower.indexOf(keywordLower);
  
  if (keywordIndex === -1) return "";
  
  const start = Math.max(0, keywordIndex - 100);
  const end = Math.min(content.length, keywordIndex + keyword.length + 100);
  let context = content.slice(start, end).trim();
  
  const regex = new RegExp(keyword, 'gi');
  context = context.replace(regex, `[${keyword}]`);
  
  return context;
}

function isInternalUrl(url: string, internalDomains: Set<string>): boolean {
  try {
    const urlDomain = new URL(url).hostname.toLowerCase();
    return internalDomains.has(urlDomain);
  } catch (error) {
    logger.error(`Error checking if URL is internal: ${error}`);
    return false;
  }
}