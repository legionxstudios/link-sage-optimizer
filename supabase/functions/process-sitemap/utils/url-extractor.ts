import { isValidWebpageUrl } from './url-validator.ts';
import { SitemapUrl } from './types.ts';

export async function extractUrlsFromXml(xml: string): Promise<SitemapUrl[]> {
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

export async function extractUrlsFromHtml(html: string, baseUrl: string): Promise<SitemapUrl[]> {
  console.log('Extracting URLs from HTML content');
  const urls: SitemapUrl[] = [];
  
  try {
    const linkPattern = /href=["'](.*?)["']/g;
    let match;
    const foundUrls = new Set<string>();

    while ((match = linkPattern.exec(html)) !== null) {
      try {
        let url = match[1].trim();
        
        if (!url || url.startsWith('#') || url.includes('javascript:') || 
            url.startsWith('mailto:') || url.startsWith('tel:')) {
          continue;
        }

        if (url.startsWith('/')) {
          url = `${baseUrl}${url}`;
        } else if (!url.startsWith('http')) {
          url = `${baseUrl}/${url}`;
        }

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