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

export function isValidContentUrl(url: string): boolean {
  try {
    if (!url) {
      logger.warn('URL is undefined or empty');
      return false;
    }

    const parsedUrl = new URL(url);
    
    // Check for excluded WordPress paths and system directories
    if (EXCLUDED_PATHS.has(parsedUrl.pathname)) {
      logger.info(`Filtered out system path: ${parsedUrl.pathname}`);
      return false;
    }

    // Check if URL contains any excluded paths
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