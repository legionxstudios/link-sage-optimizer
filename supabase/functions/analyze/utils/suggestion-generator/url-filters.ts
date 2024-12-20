import { logger } from "../logger.ts";

const EXCLUDED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.svg', 
  '.css', '.js', '.pdf', '.doc', '.docx'
];

const EXCLUDED_PATHS = [
  '/wp-content/',
  '/wp-includes/',
  '/wp-admin/',
  '/cart/',
  '/checkout/',
  '/my-account/'
];

export function isValidContentUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.toLowerCase();
    
    // Check for excluded file extensions
    if (EXCLUDED_EXTENSIONS.some(ext => path.endsWith(ext))) {
      logger.info(`Filtered out URL with excluded extension: ${url}`);
      return false;
    }
    
    // Check for excluded paths
    if (EXCLUDED_PATHS.some(excluded => path.includes(excluded))) {
      logger.info(`Filtered out URL with excluded path: ${url}`);
      return false;
    }
    
    return true;
  } catch (error) {
    logger.error(`Error validating URL ${url}:`, error);
    return false;
  }
}