import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

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
      'Accept': 'text/xml, application/xml'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: ${response.status} ${response.statusText}`);
  }

  const xmlText = await response.text();
  console.log('Received XML content length:', xmlText.length);

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  
  if (!xmlDoc) {
    throw new Error('Failed to parse sitemap XML');
  }

  const urlElements = xmlDoc.getElementsByTagName('url');
  return Array.from(urlElements).map(urlElement => {
    const locElement = urlElement.getElementsByTagName('loc')[0];
    const lastmodElement = urlElement.getElementsByTagName('lastmod')[0];
    return {
      url: locElement?.textContent || '',
      lastModified: lastmodElement?.textContent || null
    };
  }).filter(entry => entry.url);
};