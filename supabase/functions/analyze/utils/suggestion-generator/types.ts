import { ExistingPage } from "../types.ts";

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