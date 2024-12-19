export interface SitemapUrl {
  url: string;
  lastModified: string | null;
}

export interface SitemapResponse {
  urls: SitemapUrl[];
  source: 'sitemap' | 'robots' | 'html';
}