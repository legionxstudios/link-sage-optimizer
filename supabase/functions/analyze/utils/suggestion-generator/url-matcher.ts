import { logger } from "../logger.ts";
import { ExistingPage } from "./types.ts";

export function findMatchingPages(
  keyword: string,
  existingPages: ExistingPage[],
  usedUrls: Set<string>
): ExistingPage[] {
  logger.info(`Finding matches for keyword "${keyword}" in ${existingPages.length} pages`);
  
  const keywordLower = keyword.toLowerCase();
  return existingPages.filter(page => {
    if (!page.url || usedUrls.has(page.url)) {
      return false;
    }

    try {
      const url = new URL(page.url);
      
      // Skip non-content pages
      if (url.pathname.includes('/wp-content/') ||
          url.pathname.includes('/cart') ||
          url.pathname.includes('/checkout') ||
          url.pathname.includes('/my-account') ||
          url.pathname.match(/\.(jpg|jpeg|png|gif|css|js)$/)) {
        return false;
      }

      // Check if keyword appears in URL slug
      const urlSlug = url.pathname.toLowerCase();
      if (urlSlug.includes(keywordLower.replace(/\s+/g, '-'))) {
        logger.info(`Found URL match: ${page.url} for keyword "${keyword}"`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Error processing URL ${page.url}:`, error);
      return false;
    }
  });
}