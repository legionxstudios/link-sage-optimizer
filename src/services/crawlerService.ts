import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
    // First process the sitemap
    console.log("Processing sitemap for URL:", url);
    const { data: sitemapData, error: sitemapError } = await supabase.functions.invoke('process-sitemap', {
      body: { url }
    });

    if (sitemapError) {
      console.error("Sitemap processing error:", sitemapError);
      toast.error("Failed to process sitemap");
      throw sitemapError;
    }

    console.log("Sitemap processing result:", sitemapData);
    toast.success(`Found ${sitemapData?.urls?.length || 0} pages in sitemap`);

    // Then analyze the page
    console.log("Invoking analyze function with URL:", url);
    const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze', {
      body: { url }
    });

    if (analysisError) {
      console.error("Analysis error:", analysisError);
      toast.error(analysisError.message);
      throw analysisError;
    }

    console.log("Raw analysis response:", analysisData);

    if (!analysisData) {
      console.error("No analysis data received");
      toast.error("No analysis data received from server");
      throw new Error("No analysis data received from server");
    }

    // Ensure we have a valid keywords structure
    const keywords = analysisData.keywords || { 
      exact_match: [], 
      broad_match: [], 
      related_match: [] 
    };

    // Ensure we have valid suggestions
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

    return {
      keywords,
      outboundSuggestions: suggestions
    };

  } catch (error) {
    console.error("Error in page analysis:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    toast.error(errorMessage);
    throw error;
  }
};