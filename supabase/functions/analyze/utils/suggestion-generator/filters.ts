import { logger } from "../logger.ts";
import { ExistingPage } from "./types.ts";

export function filterMatchingPages(
  keyword: string,
  pages: ExistingPage[],
  usedUrls: Set<string>,
  sourceDomain: string
): ExistingPage[] {
  return pages.filter(page => {
    if (!page.url || usedUrls.has(page.url)) return false;
    
    try {
      if (!isValidContentUrl(page.url, sourceDomain)) {
        return false;
      }
      
      const urlSlug = new URL(page.url).pathname.toLowerCase();
      const keywordSlug = keyword.replace(/\s+/g, '-');
      
      // Check for exact slug match first
      if (urlSlug.includes(keywordSlug)) {
        return true;
      }
      
      // Then check title and content
      return page.title?.toLowerCase().includes(keyword) ||
             page.content?.toLowerCase().includes(keyword);
             
    } catch (error) {
      logger.error(`Error processing page URL ${page.url}:`, error);
      return false;
    }
  });
}

function isValidContentUrl(url: string, sourceDomain: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname === sourceDomain &&
           !url.includes('/wp-content/') &&
           !url.includes('/cart') &&
           !url.includes('/checkout') &&
           !url.includes('/my-account') &&
           !url.match(/\.(jpg|jpeg|png|gif|css|js)$/);
  } catch {
    return false;
  }
}