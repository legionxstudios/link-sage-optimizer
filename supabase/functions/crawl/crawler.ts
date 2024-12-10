import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { savePage, saveLink, savePageAnalysis } from "./db.ts";

export interface CrawlOptions {
  maxPages?: number;
  delay?: number;
}

export async function crawlPage(
  url: string,
  websiteId: string,
  domain: string,
  visited: Set<string>,
  toVisit: Set<string>,
  options: CrawlOptions = {}
) {
  const { delay = 1000 } = options;
  
  try {
    console.log(`Crawling: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch ${url}: ${response.status}`);
      return;
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    if (!doc) {
      console.warn(`Failed to parse HTML for ${url}`);
      return;
    }

    // Extract page content
    const title = doc.querySelector('title')?.textContent || '';
    const mainContent = extractMainContent(doc);
    const keywords = extractKeywords(mainContent);
    
    // Extract and process links
    const links = Array.from(doc.querySelectorAll('a[href]'));
    const processedLinks = [];
    
    for (const link of links) {
      const href = link.getAttribute('href');
      if (!href) continue;

      try {
        const absoluteUrl = new URL(href, url).toString();
        const isInternal = new URL(absoluteUrl).hostname === domain;
        
        if (isInternal && !visited.has(absoluteUrl)) {
          toVisit.add(absoluteUrl);
        }

        processedLinks.push({
          url: absoluteUrl,
          text: link.textContent?.trim() || '',
          context: extractLinkContext(link),
          isInternal
        });

      } catch (e) {
        console.error(`Error processing link ${href}:`, e);
      }
    }

    // Store page in database
    const page = await savePage(websiteId, url, title, mainContent);

    // Save all extracted links
    for (const link of processedLinks) {
      await saveLink(
        page.id,
        link.url,
        link.text,
        link.context,
        link.isInternal
      );
    }

    // Save page analysis
    const internalLinks = processedLinks.filter(l => l.isInternal).length;
    const externalLinks = processedLinks.filter(l => !l.isInternal).length;
    
    await savePageAnalysis(
      url,
      title,
      mainContent,
      keywords,
      internalLinks + externalLinks,
      0 // Initial inbound links count, will be updated later
    );

    // Small delay to be nice to the server
    await new Promise(resolve => setTimeout(resolve, delay));

  } catch (e) {
    console.error(`Error crawling ${url}:`, e);
    throw e;
  }
}

function extractMainContent(doc: Document): string {
  const contentSelectors = [
    'main',
    'article',
    '.content',
    '[role="main"]',
    '.post-content',
    '.entry-content'
  ];

  let content = '';
  
  // Try each selector
  for (const selector of contentSelectors) {
    const element = doc.querySelector(selector);
    if (element) {
      content = element.textContent || '';
      break;
    }
  }

  // Fallback to body if no content found
  if (!content) {
    content = doc.body?.textContent || '';
  }

  return content.trim();
}

function extractKeywords(content: string): string[] {
  // Simple keyword extraction - could be enhanced with NLP
  const words = content.toLowerCase()
    .split(/\W+/)
    .filter(word => word.length > 3)
    .reduce((acc: { [key: string]: number }, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {});

  return Object.entries(words)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([word]) => word);
}

function extractLinkContext(link: Element): string {
  const parent = link.parentElement;
  if (!parent) return '';

  const context = parent.textContent || '';
  const linkText = link.textContent || '';
  
  // Get text before and after the link
  const parts = context.split(linkText);
  if (parts.length < 2) return context;

  const before = parts[0].slice(-50).trim();
  const after = parts[1].slice(0, 50).trim();

  return `${before} [LINK] ${after}`;
}