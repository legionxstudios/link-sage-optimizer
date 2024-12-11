export interface LinkSuggestion {
  suggestedAnchorText: string;
  context: string;
  matchType: string;
  relevanceScore: number;
  targetUrl?: string;
  targetTitle?: string;
}

export interface AnalysisResult {
  keywords: {
    exact_match: string[];
    broad_match: string[];
    related_match: string[];
  };
  outboundSuggestions: LinkSuggestion[];
}

export interface WebsiteRecord {
  id: string;
  domain: string;
  last_crawled_at: string;
}

export interface PageRecord {
  id: string;
  website_id: string;
  url: string;
  title: string;
  content: string;
}