import { ExistingPage } from "./types";
import { logger } from "./logger";

export function isValidTargetUrl(url: string, existingPages: ExistingPage[]): boolean {
  // Check if URL exists in our crawled pages
  return existingPages.some(page => page.url === url);
}

export function findBestMatchingPage(
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