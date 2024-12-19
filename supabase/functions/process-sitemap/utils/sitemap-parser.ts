export interface SitemapUrl {
  url: string;
  lastModified: string | null;
}

export const fetchAndParseSitemap = async (url: string): Promise<SitemapUrl[]> => {
  const sitemapUrl = new URL('/sitemap.xml', url).toString();
  console.log('Attempting to fetch sitemap from:', sitemapUrl);

  try {
    const response = await fetch(sitemapUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LovableCrawler/1.0)',
        'Accept': 'application/xml, text/xml, */*'
      }
    });

    if (!response.ok) {
      console.error(`Failed to fetch sitemap: ${response.status} ${response.statusText}`);
      // Try alternative sitemap locations
      const alternativeUrls = [
        new URL('sitemap.xml', url).toString(),
        new URL('sitemap_index.xml', url).toString(),
        new URL('wp-sitemap.xml', url).toString() // WordPress common location
      ];

      for (const altUrl of alternativeUrls) {
        console.log('Trying alternative sitemap location:', altUrl);
        const altResponse = await fetch(altUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; LovableCrawler/1.0)',
            'Accept': 'application/xml, text/xml, */*'
          }
        });
        if (altResponse.ok) {
          const xmlText = await altResponse.text();
          return parseSitemapXml(xmlText, altUrl);
        }
      }
      throw new Error(`Failed to fetch sitemap from any known location`);
    }

    const xmlText = await response.text();
    console.log('Received XML content length:', xmlText.length);
    console.log('First 200 characters of XML:', xmlText.substring(0, 200));
    
    return parseSitemapXml(xmlText, sitemapUrl);
  } catch (error) {
    console.error('Error fetching sitemap:', error);
    throw error;
  }
};

const parseSitemapXml = async (xmlText: string, sitemapUrl: string): Promise<SitemapUrl[]> => {
  const urls: SitemapUrl[] = [];
  
  // First check if this is a sitemap index
  const sitemapIndexRegex = /<sitemap>([\s\S]*?)<\/sitemap>/g;
  const sitemapLocRegex = /<loc>(.*?)<\/loc>/;
  
  let isIndex = sitemapIndexRegex.test(xmlText);
  console.log('Is sitemap index?', isIndex);

  if (isIndex) {
    console.log('Processing sitemap index');
    const sitemapMatches = xmlText.match(sitemapIndexRegex);
    if (sitemapMatches) {
      for (const sitemapEntry of sitemapMatches) {
        const locMatch = sitemapEntry.match(sitemapLocRegex);
        if (locMatch && locMatch[1]) {
          console.log('Found child sitemap:', locMatch[1]);
          try {
            const response = await fetch(locMatch[1].trim());
            if (response.ok) {
              const childXml = await response.text();
              const childUrls = await parseSitemapXml(childXml, locMatch[1]);
              urls.push(...childUrls);
            }
          } catch (error) {
            console.error('Error fetching child sitemap:', error);
          }
        }
      }
    }
  } else {
    // Parse regular sitemap
    console.log('Processing regular sitemap');
    const urlRegex = /<url>([\s\S]*?)<\/url>/g;
    const locRegex = /<loc>(.*?)<\/loc>/;
    const lastmodRegex = /<lastmod>(.*?)<\/lastmod>/;

    let match;
    while ((match = urlRegex.exec(xmlText)) !== null) {
      const urlBlock = match[1];
      const locMatch = urlBlock.match(locRegex);
      const lastmodMatch = urlBlock.match(lastmodRegex);

      if (locMatch) {
        urls.push({
          url: locMatch[1].trim(),
          lastModified: lastmodMatch ? lastmodMatch[1].trim() : null
        });
      }
    }
  }

  console.log(`Found ${urls.length} URLs in sitemap at ${sitemapUrl}`);
  
  if (urls.length === 0) {
    console.log('No URLs found. XML content sample:', xmlText.substring(0, 500));
  }

  return urls;
};