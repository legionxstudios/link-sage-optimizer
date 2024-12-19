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

  for (const sitemapUrl of possibleSitemapUrls) {
    try {
      console.log('Attempting to fetch from:', sitemapUrl);
      
      const response = await fetch(sitemapUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LovableCrawler/1.0)',
          'Accept': 'text/xml, application/xml, text/plain, */*'
        }
      });

      if (!response.ok) {
        console.log(`Failed to fetch ${sitemapUrl}: ${response.status}`);
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/xml') && 
          !contentType.includes('application/xml') && 
          !contentType.includes('text/plain')) {
        console.log(`Skipping ${sitemapUrl} due to content type: ${contentType}`);
        continue;
      }

      const text = await response.text();
      console.log(`Received content from ${sitemapUrl}, length: ${text.length}`);
      
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
                return urls;
              }
            }
          } catch (error) {
            console.error('Error fetching sitemap from robots.txt URL:', error);
          }
        }
        continue;
      }

      // Try to parse as XML sitemap
      const urls = await extractUrlsFromXml(text);
      if (urls.length > 0) {
        console.log(`Successfully found ${urls.length} URLs in ${sitemapUrl}`);
        return urls;
      }
      
    } catch (error) {
      console.error(`Error processing ${sitemapUrl}:`, error);
    }
  }

  // If we get here, we couldn't find a valid sitemap
  throw new Error('Could not find a valid sitemap. Please ensure the site has a sitemap.xml file or check robots.txt for sitemap location.');
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
          if (url && isValidUrl(url)) {
            urls.push({
              url,
              lastModified: lastmodMatch ? lastmodMatch[1].trim() : null
            });
          }
        }
      }
    }

    console.log(`Found ${urls.length} valid URLs in XML content`);
    return urls;
    
  } catch (error) {
    console.error('Error parsing XML content:', error);
    return [];
  }
}

function isValidUrl(urlString: string): boolean {
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}