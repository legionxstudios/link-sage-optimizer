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

  useEffect(() => {
    const fetchStoredAnalysis = async () => {
      // Subscribe to changes in the page_analysis table
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
                {keywords.exact_match?.map((keyword, index) => (
                  <Badge key={index} variant="default">
                    {keyword}
                  </Badge>
                ))}
                {keywords.broad_match?.map((keyword, index) => (
                  <Badge key={index} variant="secondary">
                    {keyword}
                  </Badge>
                ))}
                {keywords.related_match?.map((keyword, index) => (
                  <Badge key={index} variant="outline">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Link Suggestions</h3>
          <p className="text-sm text-muted-foreground">
            Suggested outbound links based on content analysis and keyword relevance.
          </p>
          {outboundSuggestions && outboundSuggestions.length > 0 ? (
            <LinkSuggestions suggestions={outboundSuggestions} />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No link suggestions found for this content.
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
};