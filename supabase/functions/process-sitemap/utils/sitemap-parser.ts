export interface SitemapUrl {
  url: string;
  lastModified: string | null;
}

export const fetchAndParseSitemap = async (url: string): Promise<SitemapUrl[]> => {
  const sitemapUrl = new URL('/sitemap.xml', url).toString();
  console.log('Attempting to fetch sitemap from:', sitemapUrl);

  const response = await fetch(sitemapUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LovableCrawler/1.0)',
      'Accept': 'application/xml, text/xml'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: ${response.status} ${response.statusText}`);
  }

  const xmlText = await response.text();
  console.log('Received XML content length:', xmlText.length);

  // Simple regex-based XML parsing since we only need specific tags
  const urls: SitemapUrl[] = [];
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

  console.log(`Found ${urls.length} URLs in sitemap`);
  return urls;
};