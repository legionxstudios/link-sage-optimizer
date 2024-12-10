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

    console.log("Raw API response:", data);

    // Ensure the response matches our expected format
    const response: AnalysisResponse = {
      pageContents: data.pageContents || [],
      outboundSuggestions: Array.isArray(data.outboundSuggestions) ? data.outboundSuggestions : [],
      inboundSuggestions: Array.isArray(data.inboundSuggestions) ? data.inboundSuggestions : [],
      linkScore: data.linkScore || 0
    };

    console.log("Processed analysis results:", response);
    return response;
  } catch (error) {
    console.error("Error in page analysis:", error);
    throw error;
  }
};