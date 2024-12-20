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
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LovableCrawler/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });

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

    // Remove non-content elements first
    ['script', 'style', 'noscript', 'iframe', 'nav', 'footer', 'header'].forEach(tag => {
      doc.querySelectorAll(tag).forEach(el => el.remove());
    });

    // Extract page content
    const title = doc.querySelector('title')?.textContent?.trim() || '';
    console.log(`Extracted title: ${title}`);

    const mainContent = extractMainContent(doc);
    console.log(`Extracted content length: ${mainContent.length}`);

    const keywords = extractKeywords(mainContent);
    console.log(`Extracted keywords:`, keywords);
    
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

    // Store page in database with full content
    const page = await savePage(websiteId, url, title, mainContent);
    console.log(`Saved page with title: ${title} and content length: ${mainContent.length}`);

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
    '[role="main"]',
    '.content',
    '.post-content',
    '.entry-content',
    '.article-content',
    '#content',
    '.main-content',
    '.page-content'
  ];

  let content = '';
  
  // Try each selector
  for (const selector of contentSelectors) {
    const element = doc.querySelector(selector);
    if (element) {
      content = element.textContent || '';
      console.log(`Found content using selector: ${selector}`);
      break;
    }
  }

  // Fallback to body if no content found
  if (!content) {
    console.log('No specific content area found, using body content');
    content = doc.body?.textContent || '';
  }

  // Clean up the content
  content = content
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();

  console.log(`Extracted content length: ${content.length} characters`);
  return content;
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