import { isValidWebpageUrl } from './url-validator.ts';

export interface SitemapUrl {
  url: string;
  lastModified: string | null;
}

export const fetchAndParseSitemap = async (url: string) => {
  console.log('Starting sitemap processing for URL:', url);
  
  // Try to determine the sitemap URL by checking common locations
  const baseUrl = new URL(url);
  const possibleSitemapUrls = [
    url,
    `${baseUrl.origin}/sitemap.xml`,
    `${baseUrl.origin}/sitemap_index.xml`,
    `${baseUrl.origin}/wp-sitemap.xml`,
    `${baseUrl.origin}/robots.txt`
  ];

  console.log('Will try these sitemap locations:', possibleSitemapUrls);

  // If no sitemap is found, we'll collect URLs from the original page
  let pageUrls: SitemapUrl[] = [];

  for (const sitemapUrl of possibleSitemapUrls) {
    try {
      console.log('Attempting to fetch from:', sitemapUrl);
      
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
      console.log(`Received content from ${sitemapUrl}, type: ${contentType}, length: ${text.length}`);
      
      // If this is robots.txt, try to extract sitemap URL
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
                console.log(`Successfully extracted ${urls.length} URLs from robots.txt sitemap`);
                return urls;
              }
            }
          } catch (error) {
            console.error('Error fetching sitemap from robots.txt URL:', error);
          }
        }
        continue;
      }

      // Try to parse as XML sitemap first
      if (contentType.includes('xml') || text.includes('<?xml')) {
        const urls = await extractUrlsFromXml(text);
        if (urls.length > 0) {
          console.log(`Successfully found ${urls.length} URLs in ${sitemapUrl}`);
          return urls;
        }
      }
      
      // If we're at the original URL and it's HTML, try to extract links from it
      if (sitemapUrl === url && (contentType.includes('html') || text.includes('<!DOCTYPE html>'))) {
        console.log('Attempting to extract links from HTML page');
        const urls = await extractUrlsFromHtml(text, baseUrl.origin);
        if (urls.length > 0) {
          pageUrls = urls;
          console.log(`Found ${urls.length} valid URLs in HTML content`);
          // Continue checking other possible sitemap locations
          continue;
        }
      }
      
    } catch (error) {
      console.error(`Error processing ${sitemapUrl}:`, error);
    }
  }

  // If we found any URLs from the HTML page, return those
  if (pageUrls.length > 0) {
    return pageUrls;
  }

  throw new Error(
    'Could not find a valid sitemap or extract URLs from the page. ' +
    'Please ensure the site has a sitemap.xml file, or that the page contains valid links.'
  );
}

async function extractUrlsFromXml(xml: string): Promise<SitemapUrl[]> {
  console.log(`Processing XML content of length: ${xml.length}`);
  const urls: SitemapUrl[] = [];
  
  try {
    // First check if this is a sitemap index
    if (xml.includes('<sitemapindex')) {
      console.log('Detected sitemap index format');
      const sitemapMatches = xml.match(/<sitemap>[\s\S]*?<\/sitemap>/g) || [];
      
      for (const sitemapEntry of sitemapMatches) {
        const locMatch = sitemapEntry.match(/<loc>(.*?)<\/loc>/);
        if (locMatch && locMatch[1]) {
          const childUrl = locMatch[1].trim();
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
          const url = locMatch[1].trim();
          if (url && isValidWebpageUrl(url)) {
            urls.push({
              url,
              lastModified: lastmodMatch ? lastmodMatch[1].trim() : null
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
    // Use regex to find all links in the HTML
    const linkPattern = /href=["'](.*?)["']/g;
    let match;
    const foundUrls = new Set<string>();

    while ((match = linkPattern.exec(html)) !== null) {
      try {
        let url = match[1].trim();
        
        // Skip empty URLs, anchors, javascript:, mailto:, tel:, etc.
        if (!url || url.startsWith('#') || url.includes('javascript:') || 
            url.startsWith('mailto:') || url.startsWith('tel:')) {
          continue;
        }

        // Convert relative URLs to absolute
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
        console.error('Error processing URL:', match[1], error);
      }
    }

    console.log(`Extracted ${urls.length} valid URLs from HTML`);
    return urls;
  } catch (error) {
    console.error('Error parsing HTML content:', error);
    return [];
  }
}