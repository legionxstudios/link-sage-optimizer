import { supabase } from "@/integrations/supabase/client";

interface LinkSuggestion {
  sourceUrl: string;
  targetUrl: string;
  suggestedAnchorText: string;
  relevanceScore: number;
  context: string;
}

interface AnalysisResponse {
  pageContents: any[];
  suggestions: LinkSuggestion[];
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