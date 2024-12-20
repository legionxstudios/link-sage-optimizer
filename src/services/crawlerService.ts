import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  retries: number = MAX_RETRIES,
  delay: number = INITIAL_RETRY_DELAY
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    console.error(`Operation failed:`, error);
    
    if (retries === 0) {
      console.error('Max retries reached, failing operation');
      throw error;
    }
    
    const nextDelay = delay * 2;
    console.log(`Retrying operation in ${delay}ms, ${retries} attempts remaining`);
    await sleep(delay);
    return retryWithBackoff(operation, retries - 1, nextDelay);
  }
};

export const analyzePage = async (url: string): Promise<AnalysisResponse> => {
  if (!url) {
    throw new Error("URL is required");
  }

  try {
    new URL(url);
  } catch (error) {
    throw new Error("Invalid URL format");
  }

  console.log("Starting page analysis for:", url);
  
  try {
    // First process the sitemap
    console.log("Processing sitemap for URL:", url);
    
    const requestBody = { url };
    console.log("Sitemap request body:", requestBody);
    
    const { data: sitemapData, error: sitemapError } = await retryWithBackoff(() =>
      supabase.functions.invoke('process-sitemap', {
        body: requestBody
      })
    );

    if (sitemapError) {
      console.error("Sitemap processing error:", sitemapError);
      toast.error("Failed to process sitemap");
      throw sitemapError;
    }

    console.log("Raw sitemap response:", sitemapData);

    if (!sitemapData?.success) {
      console.error("Sitemap processing failed:", sitemapData);
      const errorMessage = sitemapData?.error || "Failed to process sitemap";
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }

    console.log("Sitemap processing result:", sitemapData);
    const urlsFound = sitemapData?.urls?.length || 0;
    toast.success(`Found ${urlsFound} pages in sitemap`);

    // Then analyze the page
    console.log("Starting content analysis for URL:", url);
    
    const { data: analysisData, error: analysisError } = await retryWithBackoff(() =>
      supabase.functions.invoke('analyze', {
        body: { url }
      })
    );

    if (analysisError) {
      console.error("Analysis error:", analysisError);
      toast.error("Failed to analyze page");
      throw analysisError;
    }

    console.log("Raw analysis response:", analysisData);

    if (!analysisData) {
      console.error("No analysis data received");
      toast.error("No analysis data received from server");
      throw new Error("No analysis data received from server");
    }

    const keywords = analysisData.keywords || { 
      exact_match: [], 
      broad_match: [], 
      related_match: [] 
    };

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

    toast.success("Analysis completed successfully!");

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