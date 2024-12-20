import { logger } from "../logger.ts";

export function isInternalUrl(url: string, sourceDomain: string): boolean {
  try {
    if (!url) {
      logger.warn('Empty URL provided for internal check');
      return false;
    }

    const urlObj = new URL(url);
    const urlDomain = urlObj.hostname.toLowerCase();
    const isInternal = urlDomain === sourceDomain.toLowerCase();
    
    logger.info(`URL ${url} is ${isInternal ? 'internal' : 'external'} to domain ${sourceDomain}`);
    return isInternal;
  } catch (error) {
    logger.error(`Error checking if URL is internal: ${error}`);
    return false;
  }
}

export function isValidContentUrl(url: string): boolean {
  try {
    return !url.includes('/wp-content/') &&
           !url.includes('/cart') &&
           !url.includes('/checkout') &&
           !url.includes('/my-account') &&
           !url.match(/\.(jpg|jpeg|png|gif|css|js)$/);
  } catch {
    return false;
  }
}