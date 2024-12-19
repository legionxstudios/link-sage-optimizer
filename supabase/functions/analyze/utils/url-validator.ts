import { logger } from "./logger.ts";

export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (e) {
    logger.warn(`Invalid URL: ${urlString}`, e);
    return false;
  }
}

export function normalizeUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    // Remove trailing slashes and normalize to lowercase
    let normalized = url.origin.toLowerCase() + url.pathname.toLowerCase();
    normalized = normalized.replace(/\/+$/, '');
    
    // Keep the query parameters if they exist, but sort them
    if (url.search) {
      const searchParams = new URLSearchParams(url.search);
      const sortedParams = new URLSearchParams([...searchParams.entries()].sort());
      normalized += '?' + sortedParams.toString();
    }
    
    logger.info(`Normalized URL: ${urlString} -> ${normalized}`);
    return normalized;
  } catch (e) {
    logger.error(`Error normalizing URL: ${urlString}`, e);
    return urlString;
  }
}
