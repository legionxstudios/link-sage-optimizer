import { Card } from "@/components/ui/card";
import { LinkSuggestions } from "./LinkSuggestions";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { AnalysisResponse } from "@/services/crawlerService";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AnalysisResultsProps {
  results: AnalysisResponse;
}

export const AnalysisResults = ({ results }: AnalysisResultsProps) => {
  const { keywords, outboundSuggestions } = results;
  console.log("Rendering AnalysisResults with:", { keywords, outboundSuggestions });

  useEffect(() => {
    const fetchStoredAnalysis = async () => {
      const channel = supabase
        .channel('page_analysis_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'page_analysis'
          },
          (payload) => {
            console.log('Database change received:', payload);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    fetchStoredAnalysis();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="space-y-6"
    >
      <Card className="p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Analysis Results</h3>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Keywords</h4>
              <div className="flex flex-wrap gap-2">
                {keywords?.exact_match?.map((keyword, index) => (
                  <Badge key={index} variant="default">
                    {keyword}
                  </Badge>
                ))}
                {keywords?.broad_match?.map((keyword, index) => (
                  <Badge key={index} variant="secondary">
                    {keyword}
                  </Badge>
                ))}
                {keywords?.related_match?.map((keyword, index) => (
                  <Badge key={index} variant="outline">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
          </div>Let me help debug this issue. Looking at the console logs, I can see the error "No suggestions found in analysis response" is being thrown, despite suggestions being present in the logs. This indicates there's likely a mismatch between the data structure we're receiving and what we're expecting in the frontend.

<lov-code>
Let's update the crawler service to properly handle the response structure:

<lov-write file_path="src/services/crawlerService.ts">
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

    // Extract suggestions from the response structure
    const suggestions = analysisData?.suggestions || analysisData?.outboundSuggestions || [];
    const keywords = analysisData?.keywords || analysisData?.seo_keywords || { 
      exact_match: [], 
      broad_match: [], 
      related_match: [] 
    };

    console.log("Extracted suggestions:", suggestions);
    console.log("Extracted keywords:", keywords);

    // Ensure suggestions are in the correct format
    const formattedSuggestions = suggestions.map((suggestion: any) => ({
      suggestedAnchorText: suggestion.suggestedAnchorText || suggestion.anchor_text || "",
      context: suggestion.context || "",
      matchType: suggestion.matchType || suggestion.match_type || "keyword_based",
      relevanceScore: suggestion.relevanceScore || suggestion.relevance_score || 0,
      targetUrl: suggestion.targetUrl || suggestion.target_url || "",
      targetTitle: suggestion.targetTitle || suggestion.target_title || ""
    }));

    console.log("Formatted suggestions:", formattedSuggestions);

    const response = {
      keywords: keywords,
      outboundSuggestions: formattedSuggestions
    };

    console.log("Final processed response:", response);
    return response;

  } catch (error) {
    console.error("Error in page analysis:", error);
    throw error;
  }
};