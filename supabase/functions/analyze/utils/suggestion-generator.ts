import { ExistingPage } from "./types.ts";
import { logger } from "./logger.ts";

export function generateSuggestions(
  keywords: { [key: string]: string[] },
  existingPages: ExistingPage[]
) {
  logger.info('Generating suggestions from keywords:', keywords);
  logger.info(`Working with ${existingPages.length} existing pages`);

  const suggestions = [];
  const usedUrls = new Set<string>();

  // Process each keyword type
  for (const [matchType, keywordList] of Object.entries(keywords)) {
    logger.info(`Processing ${keywordList.length} ${matchType} keywords`);

    for (const keyword of keywordList) {
      logger.info(`Analyzing keyword: "${keyword}"`);
      
      // Find best matching page for this keyword
      const matchingPage = findBestMatchingPage(keyword, existingPages, usedUrls);
      
      if (matchingPage) {
        logger.info(`Found matching page for "${keyword}": ${matchingPage.url}`);
        
        suggestions.push({
          suggestedAnchorText: keyword,
          targetUrl: matchingPage.url,
          targetTitle: matchingPage.title || '',
          context: `The source content contains "${keyword}" which is relevant to the target page about ${matchingPage.title}`,
          matchType: matchType,
          relevanceScore: calculateRelevanceScore(keyword, matchingPage)
        });
        
        // Track used URL to avoid duplicates
        usedUrls.add(matchingPage.url);
      } else {
        logger.info(`No matching page found for keyword: "${keyword}"`);
      }
    }
  }

  logger.info(`Generated ${suggestions.length} total suggestions`);
  return suggestions;
}

function findBestMatchingPage(
  keyword: string, 
  existingPages: ExistingPage[], 
  usedUrls: Set<string>
): ExistingPage | null {
  logger.info(`Finding best match for keyword "${keyword}" among ${existingPages.length} pages`);
  
  const validPages = existingPages.filter(page => 
    page.url && 
    page.content &&
    !usedUrls.has(page.url) &&
    !page.url.includes('/wp-content/') &&
    !page.url.includes('/cart') &&
    !page.url.includes('/checkout') &&
    !page.url.includes('/my-account') &&
    !page.url.match(/\.(jpg|jpeg|png|gif|css|js)$/)
  );

  logger.info(`Found ${validPages.length} valid pages to check`);

  // Sort pages by relevance to keyword
  const scoredPages = validPages.map(page => ({
    page,
    score: calculateRelevanceScore(keyword, page)
  }));

  // Sort by score descending
  scoredPages.sort((a, b) => b.score - a.score);

  if (scoredPages.length > 0 && scoredPages[0].score > 0.5) {
    logger.info(`Best matching page for "${keyword}": ${scoredPages[0].page.url} (score: ${scoredPages[0].score})`);
    return scoredPages[0].page;
  }

  logger.info(`No suitable match found for keyword "${keyword}"`);
  return null;
}

function calculateRelevanceScore(keyword: string, page: ExistingPage): number {
  let score = 0;
  const keywordLower = keyword.toLowerCase();
  
  // Check title
  if (page.title?.toLowerCase().includes(keywordLower)) {
    score += 0.5;
  }
  
  // Check content
  if (page.content?.toLowerCase().includes(keywordLower)) {
    const frequency = (page.content.toLowerCase().match(new RegExp(keywordLower, 'g')) || []).length;
    score += Math.min(0.5, frequency * 0.1);
  }
  
  return Math.min(1.0, score);
}