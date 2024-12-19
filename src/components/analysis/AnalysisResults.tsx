import { Card } from "@/components/ui/card";
import { LinkSuggestions } from "./LinkSuggestions";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { AnalysisResponse } from "@/services/crawlerService";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AnalysisResultsProps {
  results: AnalysisResponse | null;
}

export const AnalysisResults = ({ results }: AnalysisResultsProps) => {
  console.log("Rendering AnalysisResults with:", results);

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

  if (!results) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No analysis results available.
      </div>
    );
  }

  const { keywords, outboundSuggestions } = results;

  // Helper function to clean and format keyword strings
  const formatKeyword = (keyword: string): string => {
    // Extract just the keyword part before the dash and context
    const parts = keyword.split(' - ');
    return parts[0].trim();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="space-y-6"
    >
      {keywords && (
        <Card className="p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Keywords Analysis</h3>
            </div>

            <div className="space-y-4">
              {keywords.exact_match?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Exact Match Keywords</h4>
                  <div className="flex flex-wrap gap-2">
                    {keywords.exact_match.map((keyword, index) => (
                      <Badge key={index} variant="default">
                        {formatKeyword(keyword)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {keywords.broad_match?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Broad Match Keywords</h4>
                  <div className="flex flex-wrap gap-2">
                    {keywords.broad_match.map((keyword, index) => (
                      <Badge key={index} variant="secondary">
                        {formatKeyword(keyword)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {keywords.related_match?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Related Keywords</h4>
                  <div className="flex flex-wrap gap-2">
                    {keywords.related_match.map((keyword, index) => (
                      <Badge key={index} variant="outline">
                        {formatKeyword(keyword)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {outboundSuggestions && outboundSuggestions.length > 0 && (
        <Card className="p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Link Suggestions</h3>
            <LinkSuggestions suggestions={outboundSuggestions} />
          </div>
        </Card>
      )}
    </motion.div>
  );
};