export interface SitemapUrl {
  url: string;
  lastModified: string | null;
}

export const fetchAndParseSitemap = async (url: string) => {
  console.log('Starting sitemap processing for URL:', url);
  
  // Try to determine the sitemap URL
  const possibleSitemapUrls = [
    url,
    new URL('/sitemap.xml', url).toString(),
    new URL('/sitemap_index.xml', url).toString(),
    new URL('/wp-sitemap.xml', url).toString(),
    new URL('/robots.txt', url).toString()
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
              return extractUrlsFromXml(sitemapText, robotsSitemapUrl);
            }
          } catch (error) {
            console.error('Error fetching sitemap from robots.txt URL:', error);
          }
        }
        continue;
      }

      const urls = extractUrlsFromXml(text, sitemapUrl);
      if (urls.length > 0) {
        console.log(`Successfully found ${urls.length} URLs in ${sitemapUrl}`);
        return urls;
      }
      
    } catch (error) {
      console.error(`Error processing ${sitemapUrl}:`, error);
    }
  }

  throw new Error('No valid sitemap found at any common location');
}

function extractUrlsFromXml(xml: string, sourceUrl: string): SitemapUrl[] {
  console.log(`Extracting URLs from XML content from ${sourceUrl}`);
  const urls: SitemapUrl[] = [];
  
  // First check if this is a sitemap index
  if (xml.includes('<sitemapindex')) {
    console.log('Detected sitemap index format');
    // Extract URLs from sitemap index
    const sitemapMatches = xml.match(/<sitemap>[\s\S]*?<\/sitemap>/g) || [];
    
    for (const sitemapEntry of sitemapMatches) {
      const locMatch = sitemapEntry.match(/<loc>(.*?)<\/loc>/);
      if (locMatch && locMatch[1]) {
        const childUrl = locMatch[1].trim();
        console.log('Found child sitemap:', childUrl);
        try {
          const response = fetch(childUrl);
          if (response) {
            const childXml = response.text();
            const childUrls = extractUrlsFromXml(childXml, childUrl);
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
        urls.push({
          url: locMatch[1].trim(),
          lastModified: lastmodMatch ? lastmodMatch[1].trim() : null
        });
      }
    }
  }

  console.log(`Found ${urls.length} URLs in XML content`);
  if (urls.length === 0) {
    console.log('Sample of content that yielded no URLs:', xml.substring(0, 500));
  } else {
    console.log('Sample URLs found:', urls.slice(0, 3));
  }

  return urls;
}