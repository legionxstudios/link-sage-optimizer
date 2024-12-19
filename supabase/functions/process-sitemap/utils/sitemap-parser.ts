import { isValidWebpageUrl } from './url-validator.ts';
import { SitemapUrl, SitemapResponse } from './types.ts';
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

export const fetchAndParseSitemap = async (url: string): Promise<SitemapResponse> => {
  console.log('Starting sitemap processing for URL:', url);
  
  const baseUrl = new URL(url);
  const possibleSitemapUrls = [
    `${baseUrl.origin}/sitemap.xml`,
    `${baseUrl.origin}/sitemap_index.xml`,
    `${baseUrl.origin}/wp-sitemap.xml`,
    `${baseUrl.origin}/robots.txt`,
    url // Try the original URL last
  ];

  console.log('Checking these potential sitemap locations:', possibleSitemapUrls);
  let pageUrls: SitemapUrl[] = [];
  let lastError: Error | null = null;

  for (const sitemapUrl of possibleSitemapUrls) {
    try {
      console.log(`Attempting to fetch: ${sitemapUrl}`);
      
      const response = await fetch(sitemapUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LovableCrawler/1.0)',
          'Accept': 'text/xml, application/xml, text/html, text/plain, */*'
        }
      });

      if (!response.ok) {
        console.log(`Failed to fetch ${sitemapUrl}: ${response.status}`);
        continue;
      }

      const contentType = response.headers.get('content-type')?.toLowerCase() || '';
      const text = await response.text();
      
      console.log(`Received content from ${sitemapUrl}:`, {
        contentType,
        length: text.length,
        preview: text.substring(0, 100)
      });

      // Handle robots.txt
      if (sitemapUrl.endsWith('robots.txt')) {
        const sitemapMatch = text.match(/Sitemap:\s*(.+)/i);
        if (sitemapMatch && sitemapMatch[1]) {
          const robotsSitemapUrl = sitemapMatch[1].trim();
          console.log('Found sitemap URL in robots.txt:', robotsSitemapUrl);
          try {
            const sitemapResponse = await fetch(robotsSitemapUrl);
            if (sitemapResponse.ok) {
              const sitemapText = await sitemapResponse.text();
              const urls = await extractUrlsFromXml(sitemapText);
              if (urls.length > 0) {
                console.log(`Found ${urls.length} URLs in robots.txt sitemap`);
                return { urls, source: 'robots' };
              }
            }
          } catch (error) {
            console.error('Error fetching sitemap from robots.txt:', error);
            lastError = error;
          }
        }
        continue;
      }

      // Try parsing as XML sitemap
      if (contentType.includes('xml') || text.includes('<?xml') || text.includes('<urlset')) {
        const urls = await extractUrlsFromXml(text);
        if (urls.length > 0) {
          console.log(`Successfully found ${urls.length} URLs in XML sitemap`);
          return { urls, source: 'sitemap' };
        }
      }
      
      // Try HTML parsing if XML parsing failed or for the original URL
      if (contentType.includes('html') || text.includes('<!DOCTYPE html>')) {
        console.log('Attempting to extract links from HTML content');
        const urls = await extractUrlsFromHtml(text, baseUrl.origin);
        if (urls.length > 0) {
          pageUrls = urls;
          console.log(`Found ${urls.length} valid URLs in HTML content`);
          continue;
        }
      }
      
    } catch (error) {
      console.error(`Error processing ${sitemapUrl}:`, error);
      lastError = error;
    }
  }

  // Return HTML URLs if found
  if (pageUrls.length > 0) {
    return { urls: pageUrls, source: 'html' };
  }

  // If we got here, we couldn't find any valid URLs
  throw new Error(
    lastError?.message || 
    'Could not find a valid sitemap or extract URLs from the page. ' +
    'Please ensure the site has a sitemap.xml file, or that the page contains valid links.'
  );
};

function cleanUrl(url: string): string {
  // Remove CDATA if present
  const cdataMatch = url.match(/<!\[CDATA\[(.*?)\]\]>/);
  if (cdataMatch) {
    return cdataMatch[1].trim();
  }
  return url.trim();
}

async function extractUrlsFromXml(xml: string): Promise<SitemapUrl[]> {
  console.log('Processing XML content');
  const urls: SitemapUrl[] = [];
  
  try {
    // First check if this is a sitemap index
    if (xml.includes('<sitemapindex')) {
      console.log('Detected sitemap index format');
      const sitemapMatches = xml.match(/<sitemap>[\s\S]*?<\/sitemap>/g) || [];
      
      for (const sitemapEntry of sitemapMatches) {
        const locMatch = sitemapEntry.match(/<loc>(.*?)<\/loc>/);
        if (locMatch && locMatch[1]) {
          const childUrl = cleanUrl(locMatch[1]);
          console.log('Found child sitemap:', childUrl);
          try {
            const response = await fetch(childUrl);
            if (response.ok) {
              const childXml = await response.text();
              const childUrls = await extractUrlsFromXml(childXml);
              urls.push(...childUrls);
            }
          } catch (error) {
            console.error(`Error fetching child sitemap ${childUrl}:`, error);
          }
        }
      }
    } else {
      // Parse regular sitemap
      console.log('Processing regular sitemap format');
      const urlMatches = xml.match(/<url>[\s\S]*?<\/url>/g) || [];
      
      for (const urlEntry of urlMatches) {
        const locMatch = urlEntry.match(/<loc>(.*?)<\/loc>/);
        const lastmodMatch = urlEntry.match(/<lastmod>(.*?)<\/lastmod>/);
        
        if (locMatch && locMatch[1]) {
          const url = cleanUrl(locMatch[1]);
          if (url && isValidWebpageUrl(url)) {
            urls.push({
              url,
              lastModified: lastmodMatch ? cleanUrl(lastmodMatch[1]) : null
            });
          } else {
            console.log(`Filtered out invalid or non-webpage URL: ${url}`);
          }
        }
      }
    }

    console.log(`Found ${urls.length} valid webpage URLs in XML content`);
    return urls;
    
  } catch (error) {
    console.error('Error parsing XML content:', error);
    return [];
  }
}

async function extractUrlsFromHtml(html: string, baseUrl: string): Promise<SitemapUrl[]> {
  console.log('Extracting URLs from HTML content');
  const urls: SitemapUrl[] = [];
  
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (!doc) {
      throw new Error('Failed to parse HTML');
    }

    const links = doc.querySelectorAll('a[href]');
    const foundUrls = new Set<string>();

    links.forEach((link: Element) => {
      try {
        let url = link.getAttribute('href')?.trim();
        
        if (!url || url.startsWith('#') || url.includes('javascript:') || 
            url.startsWith('mailto:') || url.startsWith('tel:')) {
          return;
        }

        // Handle relative URLs
        if (url.startsWith('/')) {
          url = `${baseUrl}${url}`;
        } else if (!url.startsWith('http')) {
          url = `${baseUrl}/${url}`;
        }

        // Validate and deduplicate URLs
        if (isValidWebpageUrl(url) && !foundUrls.has(url)) {
          foundUrls.add(url);
          urls.push({ url, lastModified: null });
        }
      } catch (error) {
        console.error('Error processing link:', error);
      }
    });

    console.log(`Extracted ${urls.length} valid URLs from HTML`);
    return urls;
  } catch (error) {
    console.error('Error parsing HTML content:', error);
    return [];
  }
}