export interface SitemapUrl {
  url: string;
  lastModified: string | null;
}

export const fetchAndParseSitemap = async (url: string): Promise<SitemapUrl[]> => {
  // Try to determine the sitemap URL
  const possibleSitemapUrls = [
    new URL('/sitemap.xml', url).toString(),
    new URL('sitemap.xml', url).toString(),
    new URL('sitemap_index.xml', url).toString(),
    new URL('wp-sitemap.xml', url).toString(),
    // Add robots.txt check
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

      const contentType = response.headers.get('content-type')?.toLowerCase() || '';
      console.log(`Content-Type for ${sitemapUrl}:`, contentType);

      const text = await response.text();
      console.log(`Received content length for ${sitemapUrl}:`, text.length);
      console.log('First 200 chars:', text.substring(0, 200));

      // If this is robots.txt, try to extract sitemap URL
      if (sitemapUrl.endsWith('robots.txt')) {
        const sitemapMatch = text.match(/Sitemap:\s*(.+)/i);
        if (sitemapMatch && sitemapMatch[1]) {
          const robotsSitemapUrl = sitemapMatch[1].trim();
          console.log('Found sitemap URL in robots.txt:', robotsSitemapUrl);
          try {
            const sitemapResponse = await fetch(robotsSitemapUrl);
            if (sitemapResponse.ok) {
              return parseSitemapXml(await sitemapResponse.text(), robotsSitemapUrl);
            }
          } catch (error) {
            console.error('Error fetching sitemap from robots.txt URL:', error);
          }
        }
        continue;
      }

      // Try to parse as XML
      const urls = await parseSitemapXml(text, sitemapUrl);
      if (urls.length > 0) {
        console.log(`Successfully found ${urls.length} URLs in ${sitemapUrl}`);
        return urls;
      }
    } catch (error) {
      console.error(`Error processing ${sitemapUrl}:`, error);
    }
  }

  throw new Error('No valid sitemap found at any common location');
};

const parseSitemapXml = async (xmlText: string, sitemapUrl: string): Promise<SitemapUrl[]> => {
  const urls: SitemapUrl[] = [];
  
  // Handle both sitemap index and regular sitemap formats
  const patterns = {
    sitemapIndex: /<sitemap>([\s\S]*?)<\/sitemap>/g,
    urlEntry: /<url>([\s\S]*?)<\/url>/g,
    loc: /<loc>(.*?)<\/loc>/,
    lastmod: /<lastmod>(.*?)<\/lastmod>/
  };

  // First check if this is a sitemap index
  const isSitemapIndex = xmlText.includes('<sitemapindex');
  console.log(`${sitemapUrl} is sitemap index?`, isSitemapIndex);

  if (isSitemapIndex) {
    console.log('Processing sitemap index');
    const sitemapMatches = xmlText.match(patterns.sitemapIndex) || [];
    
    for (const sitemapEntry of sitemapMatches) {
      const locMatch = sitemapEntry.match(patterns.loc);
      if (locMatch && locMatch[1]) {
        const childUrl = locMatch[1].trim();
        console.log('Found child sitemap:', childUrl);
        
        try {
          const response = await fetch(childUrl);
          if (response.ok) {
            const childUrls = await parseSitemapXml(await response.text(), childUrl);
            urls.push(...childUrls);
          }
        } catch (error) {
          console.error(`Error fetching child sitemap ${childUrl}:`, error);
        }
      }
    }
  } else {
    // Parse regular sitemap
    console.log('Processing regular sitemap');
    const urlMatches = xmlText.match(patterns.urlEntry) || [];
    
    for (const urlEntry of urlMatches) {
      const locMatch = urlEntry.match(patterns.loc);
      const lastmodMatch = urlEntry.match(patterns.lastmod);
      
      if (locMatch && locMatch[1]) {
        urls.push({
          url: locMatch[1].trim(),
          lastModified: lastmodMatch ? lastmodMatch[1].trim() : null
        });
      }
    }
  }

  console.log(`Found ${urls.length} URLs in ${sitemapUrl}`);
  if (urls.length === 0) {
    console.log('Sample of content that yielded no URLs:', xmlText.substring(0, 500));
  } else {
    console.log('Sample URLs found:', urls.slice(0, 3));
  }

  return urls;
};