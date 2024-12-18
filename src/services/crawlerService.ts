import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

export interface LinkSuggestion {
  suggestedAnchorText: string;
  context: string;
  matchType: string;
  relevanceScore: number;
  targetUrl: string;
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
      toast({
        title: "Analysis Error",
        description: analysisError.message,
        variant: "destructive"
      });
      throw new Error(analysisError.message);
    }

    console.log("Raw analysis response:", analysisData);

    if (!analysisData) {
      console.error("No analysis data received");
      toast({
        title: "Analysis Error",
        description: "No analysis data received from server",
        variant: "destructive"
      });
      throw new Error("No analysis data received from server");
    }

    // Ensure we have a valid keywords structure
    const keywords = analysisData.keywords || { 
      exact_match: [], 
      broad_match: [], 
      related_match: [] 
    };

    // Ensure we have valid suggestions with target URLs
    const suggestions = (analysisData.outboundSuggestions || []).map((suggestion: any) => ({
      suggestedAnchorText: suggestion.suggestedAnchorText || "",
      context: suggestion.context || "",
      matchType: suggestion.matchType || "keyword_based",
      relevanceScore: suggestion.relevanceScore || 0,
      targetUrl: suggestion.targetUrl || "",
      targetTitle: suggestion.targetTitle || ""
    }));

    console.log("Processed keywords:", keywords);
    console.log("Processed suggestions:", suggestions);

    toast({
      title: "Analysis Complete",
      description: `Found ${keywords.exact_match.length} primary keywords and ${suggestions.length} link suggestions`,
    });

    return {
      keywords,
      outboundSuggestions: suggestions
    };

  } catch (error) {
    console.error("Error in page analysis:", error);
    toast({
      title: "Analysis Failed",
      description: error instanceof Error ? error.message : "Unknown error occurred",
      variant: "destructive"
    });
    throw error;
  }
};