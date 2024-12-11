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

    console.log("Raw API response:", analysisData);

    // Store the analysis results in the database
    const { error: dbError } = await supabase
      .from('page_analysis')
      .upsert({
        url,
        title: analysisData.title,
        content: analysisData.content,
        detected_themes: analysisData.themes,
        main_keywords: analysisData.keywords?.exact_match || [],
        seo_keywords: analysisData.keywords || {},
        suggestions: analysisData.outboundSuggestions,
        created_at: new Date().toISOString()
      })
      .select();

    if (dbError) {
      console.error("Error storing analysis:", dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    return {
      keywords: analysisData.keywords || { exact_match: [], broad_match: [], related_match: [] },
      outboundSuggestions: Array.isArray(analysisData.outboundSuggestions) ? analysisData.outboundSuggestions : []
    };
  } catch (error) {
    console.error("Error in page analysis:", error);
    throw error;
  }
};