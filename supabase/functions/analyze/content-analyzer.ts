import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
import { logger } from "./utils/logger.ts";

interface Link {
  url: string;
  text: string;
  context: string;
  is_internal: boolean;
}

export async function extractContent(url: string) {
  console.log('Extracting content from:', url);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkAnalyzerBot/1.0; +http://example.com/bot)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    logger.debug('Received HTML length:', html.length);
    
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (!doc) {
      throw new Error('Failed to parse webpage');
    }

    // Remove script tags and other non-content elements first
    ['script', 'style', 'noscript', 'iframe', 'nav', 'footer', 'header'].forEach(tag => {
      doc.querySelectorAll(tag).forEach(el => el.remove());
    });

    const title = doc.querySelector('title')?.textContent?.trim() || '';
    logger.info('Extracted title:', title);
    
    const mainContent = extractMainContent(doc);
    logger.info('Extracted content length:', mainContent.length);
    logger.debug('Content sample:', mainContent.substring(0, 200));
    
    const links = extractLinks(doc, url);
    logger.info('Extracted links count:', links.length);

    // Log the extracted data for debugging
    logger.info('Extracted page data:', {
      title,
      contentLength: mainContent.length,
      linksCount: links.length
    });

    return {
      title,
      content: mainContent,
      links
    };
  } catch (error) {
    logger.error('Error extracting content:', error);
    throw error;
  }
}

function extractMainContent(doc: Document): string {
  // Remove non-content elements first
  ['script', 'style', 'code', 'pre', 'noscript', 'iframe'].forEach(tag => {
    doc.querySelectorAll(tag).forEach(el => el.remove());
  });

  const contentSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.content',
    '.post-content',
    '.entry-content',
    '.article-content',
    '#content'
  ];

  // Find main content container
  let contentArea = null;
  for (const selector of contentSelectors) {
    contentArea = doc.querySelector(selector);
    if (contentArea) break;
  }

  // Fallback to body if no content area found
  if (!contentArea) {
    contentArea = doc.body;
  }

  if (!contentArea) return '';

  // Extract text from relevant elements
  const textElements = contentArea.querySelectorAll(
    'p, h1, h2, h3, h4, h5, h6, li, td, th, div:not([class*="nav"]):not([class*="menu"]):not([class*="header"]):not([class*="footer"])'
  );

  const contentParts: string[] = [];
  textElements.forEach(element => {
    // Skip elements that are likely navigation or non-content
    if (element.className && /nav|menu|header|footer|sidebar|comment/.test(element.className)) {
      return;
    }

    const text = element.textContent?.trim();
    if (text && text.length > 0) {
      contentParts.push(text);
    }
  });

  return contentParts.join('\n\n');
}

function extractLinks(doc: Document, baseUrl: string): Link[] {
  const domain = new URL(baseUrl).hostname;
  const links = Array.from(doc.querySelectorAll('a[href]'))
    .map(link => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
        return null;
      }

      try {
        const absoluteUrl = new URL(href, baseUrl).toString();
        const isInternal = new URL(absoluteUrl).hostname === domain;

        return {
          url: absoluteUrl,
          text: link.textContent?.trim() || '',
          context: extractLinkContext(link),
          is_internal: isInternal
        };
      } catch (e) {
        console.error(`Error processing link ${href}:`, e);
        return null;
      }
    })
    .filter((link): link is Link => link !== null);

  return links;
}

function extractLinkContext(link: Element): string {
  const parent = link.parentElement;
  if (!parent) return '';

  const context = parent.textContent || '';
  const linkText = link.textContent || '';
  
  const parts = context.split(linkText);
  if (parts.length < 2) return context.slice(0, 150);

  const before = parts[0].slice(-75).trim();
  const after = parts[1].slice(0, 75).trim();

  return `${before} [LINK] ${after}`;
}