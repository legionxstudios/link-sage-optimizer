import { logger } from "../logger.ts";

export function isValidUrl(url: string): boolean {
  if (!url) {
    logger.warn('URL is undefined or empty');
    return false;
  }

  try {
    new URL(url);
    return true;
  } catch (error) {
    logger.error(`Invalid URL: ${url}`, error);
    return false;
  }
}

export function isInternalUrl(url: string, internalDomains: Set<string>): boolean {
  try {
    if (!url) return false;
    const urlDomain = new URL(url).hostname.toLowerCase();
    return internalDomains.has(urlDomain);
  } catch (error) {
    logger.error(`Error checking if URL is internal: ${error}`);
    return false;
  }
}

export function extractUrlDomain(url: string): string | null {
  try {
    if (!isValidUrl(url)) {
      return null;
    }
    return new URL(url).hostname;
  } catch (error) {
    logger.error(`Error extracting domain from URL: ${url}`, error);
    return null;
  }
}