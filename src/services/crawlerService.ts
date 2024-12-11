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
    console.log("Invoking analyze function with URL:", url);
    const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze', {
      body: { url }
    });

    if (analysisError) {
      console.error("Analysis error:", analysisError);
      throw new Error(analysisError.message);
    }

    console.log("Raw analysis response:", analysisData);

    // Verify the response structure
    if (!analysisData) {
      console.error("No analysis data received");
      throw new Error("No analysis data received from server");
    }

    if (!analysisData.keywords) {
      console.error("No keywords in analysis data:", analysisData);
      throw new Error("No keywords found in analysis response");
    }

    if (!analysisData.outboundSuggestions) {
      console.error("No suggestions in analysis data:", analysisData);
      throw new Error("No suggestions found in analysis response");
    }

    const response = {
      keywords: analysisData.keywords || { exact_match: [], broad_match: [], related_match: [] },
      outboundSuggestions: Array.isArray(analysisData.outboundSuggestions) ? analysisData.outboundSuggestions : []
    };

    console.log("Processed analysis response:", response);
    return response;

  } catch (error) {
    console.error("Error in page analysis:", error);
    throw error;
  }
};