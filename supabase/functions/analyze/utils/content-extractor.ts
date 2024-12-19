import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
import { logger } from "./logger.ts";

export async function extractContent(url: string) {
  try {
    logger.info('Fetching content from URL:', url);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkAnalyzerBot/1.0)',
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    if (!doc) {
      throw new Error('Failed to parse webpage');
    }

    const title = doc.querySelector('title')?.textContent || '';
    const mainContent = extractMainContent(doc);
    
    logger.info('Content extracted successfully', {
      title,
      contentLength: mainContent.length
    });
    
    return { title, content: mainContent };
  } catch (error) {
    logger.error('Error extracting content:', error);
    throw error;
  }
}

function extractMainContent(doc: Document): string {
  try {
    // Remove non-content elements
    ['script', 'style', 'nav', 'footer', 'header', 'aside'].forEach(tag => {
      doc.querySelectorAll(tag).forEach(el => el.remove());
    });

    // Find main content container
    const selectors = [
      'main',
      'article',
      '[role="main"]',
      '.content',
      '.post-content',
      '.entry-content',
      '#content'
    ];

    let mainElement = null;
    for (const selector of selectors) {
      mainElement = doc.querySelector(selector);
      if (mainElement) break;
    }

    // Fallback to body if no main content found
    if (!mainElement) {
      mainElement = doc.body;
    }

    if (!mainElement) {
      logger.warn('No content container found');
      return '';
    }

    // Extract text content
    const textContent = mainElement.textContent || '';
    return textContent.replace(/\s+/g, ' ').trim();
  } catch (error) {
    logger.error('Error extracting main content:', error);
    throw error;
  }
}