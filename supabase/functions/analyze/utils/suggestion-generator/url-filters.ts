import { logger } from "../logger.ts";

const INVALID_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp',
  'css', 'js', 'json',
  'pdf', 'doc', 'docx', 'xls', 'xlsx',
  'zip', 'rar', 'tar', 'gz',
  'mp3', 'mp4', 'avi', 'mov'
]);

const EXCLUDED_PATHS = new Set([
  '/wp-content/',
  '/wp-includes/',
  '/wp-admin/',
  '/cart',
  '/checkout',
  '/my-account'
]);

export function isValidContentUrl(url: string, sourceDomain: string): boolean {
  try {
    if (!url) {
      logger.warn('URL is undefined or empty');
      return false;
    }

    const parsedUrl = new URL(url);
    
    // Check if URL is from the same domain
    if (parsedUrl.hostname.toLowerCase() !== sourceDomain.toLowerCase()) {
      logger.info(`Filtered out external domain: ${parsedUrl.hostname}`);
      return false;
    }

    // Check for excluded paths
    for (const excludedPath of EXCLUDED_PATHS) {
      if (parsedUrl.pathname.includes(excludedPath)) {
        logger.info(`Filtered out URL containing excluded path ${excludedPath}: ${url}`);
        return false;
      }
    }

    // Get file extension if any
    const extension = parsedUrl.pathname.split('.').pop()?.toLowerCase();
    if (extension && INVALID_EXTENSIONS.has(extension)) {
      logger.info(`Filtered out file with extension: ${extension}`);
      return false;
    }

    return true;
  } catch (error) {
    logger.error(`Error validating URL ${url}:`, error);
    return false;
  }
}