import { supabase } from "@/integrations/supabase/client";

export interface LinkSuggestion {
  suggestedAnchorText: string;
  context: string;
  matchType: string;
  relevanceScore: number;
}

export interface AnalysisResponse {
  keywords: {
    exact_match: string[];
    broad_match: string[];
    related_match: string[];
  };
  outboundSuggestions: LinkSuggestion[];
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

    return {
      keywords: data.keywords || { exact_match: [], broad_match: [], related_match: [] },
      outboundSuggestions: Array.isArray(data.outboundSuggestions) ? data.outboundSuggestions : []
    };
  } catch (error) {
    console.error("Error in page analysis:", error);
    throw error;
  }
};