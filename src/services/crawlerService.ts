import { supabase } from "@/integrations/supabase/client";

export interface LinkSuggestion {
  suggestedAnchorText: string;
  context: string;
  matchType: string;
  relevanceScore: number;
  targetUrl?: string;
  targetTitle?: string;
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
    // First analyze the page using our edge function
    const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze', {
      body: { url }
    });

    if (analysisError) {
      console.error("Analysis error:", analysisError);
      throw new Error(analysisError.message);
    }

    console.log("Analysis completed successfully:", analysisData);

    return {
      keywords: analysisData.keywords || { exact_match: [], broad_match: [], related_match: [] },
      outboundSuggestions: Array.isArray(analysisData.outboundSuggestions) ? analysisData.outboundSuggestions : []
    };
  } catch (error) {
    console.error("Error in page analysis:", error);
    throw error;
  }
};