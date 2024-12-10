import { supabase } from "@/integrations/supabase/client";

export interface PageContent {
  url: string;
  title: string;
  content: string;
  mainKeywords: string[];
  internalLinksCount: number;
  externalLinksCount: number;
}

export interface LinkSuggestion {
  sourceUrl: string;
  targetUrl: string;
  suggestedAnchorText: string;
  matchType: string;
  relevanceScore: number;
  context: string;
}

export interface AnalysisResponse {
  pageContents: PageContent[];
  outboundSuggestions: LinkSuggestion[];
  inboundSuggestions: LinkSuggestion[];
  linkScore: number;
}

export const analyzePage = async (url: string): Promise<AnalysisResponse> => {
  console.log("Starting page analysis for:", url);
  
  try {
    const { data, error } = await supabase.functions.invoke('analyze', {
      body: { url }
    });

    if (error) {
      console.error("Analysis error:", error);
      throw new Error(error.message);
    }

    console.log("Analysis results:", data);
    return data;
  } catch (error) {
    console.error("Error in page analysis:", error);
    throw error;
  }
};