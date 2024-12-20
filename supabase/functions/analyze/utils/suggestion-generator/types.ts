export interface SuggestionGeneratorOptions {
  keywords: { [key: string]: string[] };
  existingPages: ExistingPage[];
  sourceUrl: string;
}

export interface Suggestion {
  suggestedAnchorText: string;
  targetUrl: string;
  targetTitle: string;
  context: string;
  matchType: string;
  relevanceScore: number;
}

export interface ExistingPage {
  url: string;
  title?: string;
  content?: string;
}