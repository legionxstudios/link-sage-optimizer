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
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      throw new Error('Failed to analyze page');
    }

    const data = await response.json();
    console.log("Analysis response:", data);

    return {
      keywords: data.keywords || { exact_match: [], broad_match: [], related_match: [] },
      outboundSuggestions: data.outboundSuggestions || []
    };
  } catch (error) {
    console.error("Error in page analysis:", error);
    throw error;
  }
};