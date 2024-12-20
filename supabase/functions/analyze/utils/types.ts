export interface ExistingLink {
  url: string;
  anchorText: string;
}

export interface ExistingPage {
  url: string;
  title?: string;
  content?: string;
  metadata?: {
    detected_themes?: string[];
  };
}

export interface AnalysisResult {
  keywords: {
    exact_match: string[];
    broad_match: string[];
    related_match: string[];
  };
  outboundSuggestions: Array<{
    suggestedAnchorText: string;
    targetUrl: string;
    targetTitle: string;
    context: string;
    matchType: string;
    relevanceScore: number;
  }>;
  themes?: string[];
}