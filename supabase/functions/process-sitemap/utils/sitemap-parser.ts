import { isValidWebpageUrl } from './url-validator.ts';
import { extractUrlsFromXml, extractUrlsFromHtml } from './url-extractor.ts';
import { SitemapUrl, SitemapResponse } from './types.ts';

export const fetchAndParseSitemap = async (url: string): Promise<SitemapResponse> => {
  console.log('Starting sitemap processing for URL:', url);
  
  const baseUrl = new URL(url);
  const possibleSitemapUrls = [
    url,
    `${baseUrl.origin}/sitemap.xml`,
    `${baseUrl.origin}/sitemap_index.xml`,
    `${baseUrl.origin}/wp-sitemap.xml`,
    `${baseUrl.origin}/robots.txt`
  ];

  console.log('Will try these sitemap locations:', possibleSitemapUrls);
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
                console.log(`Successfully extracted ${urls.length} URLs from robots.txt sitemap`);
                return { urls, source: 'robots' };
              }
            }
          } catch (error) {
            console.error('Error fetching sitemap from robots.txt URL:', error);
          }
        }
        continue;
      }

      // Try XML sitemap first
      if (contentType.includes('xml') || text.includes('<?xml')) {
        const urls = await extractUrlsFromXml(text);
        if (urls.length > 0) {
          console.log(`Successfully found ${urls.length} URLs in ${sitemapUrl}`);
          return { urls, source: 'sitemap' };
        }
      }
      
      // Try HTML parsing if at original URL
      if (sitemapUrl === url && (contentType.includes('html') || text.includes('<!DOCTYPE html>'))) {
        console.log('Attempting to extract links from HTML page');
        const urls = await extractUrlsFromHtml(text, baseUrl.origin);
        if (urls.length > 0) {
          pageUrls = urls;
          console.log(`Found ${urls.length} valid URLs in HTML content`);
          continue;
        }
      }
      
    } catch (error) {
      console.error(`Error processing ${sitemapUrl}:`, error);
    }
  }

  // Return HTML URLs if found
  if (pageUrls.length > 0) {
    return { urls: pageUrls, source: 'html' };
  }

  throw new Error(
    'Could not find a valid sitemap or extract URLs from the page. ' +
    'Please ensure the site has a sitemap.xml file, or that the page contains valid links.'
  );
};