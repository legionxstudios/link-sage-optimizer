import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { savePage, saveLink } from "./db.ts";

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
    const mainContent = doc.querySelector('main, article, .content, [role="main"]')?.textContent || 
                       doc.body?.textContent || '';
    
    // Store page in database
    const page = await savePage(websiteId, url, title, mainContent);

    // Extract and process links
    const links = Array.from(doc.querySelectorAll('a[href]'));
    for (const link of links) {
      const href = link.getAttribute('href');
      if (!href) continue;

      try {
        const absoluteUrl = new URL(href, url).toString();
        const isInternal = new URL(absoluteUrl).hostname === domain;
        
        if (isInternal && !visited.has(absoluteUrl)) {
          toVisit.add(absoluteUrl);
        }

        await saveLink(
          page.id,
          absoluteUrl,
          link.textContent?.trim() || '',
          link.parentElement?.textContent?.trim() || '',
          isInternal
        );

      } catch (e) {
        console.error(`Error processing link ${href}:`, e);
      }
    }

    // Small delay to be nice to the server
    await new Promise(resolve => setTimeout(resolve, delay));

  } catch (e) {
    console.error(`Error crawling ${url}:`, e);
    throw e;
  }
}