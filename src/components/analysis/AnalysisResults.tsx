import { Card } from "@/components/ui/card";
import { ArrowDown, ArrowUp, Star } from "lucide-react";
import { AnalysisMetricCard } from "./AnalysisMetricCard";
import { PageIssuesList } from "./PageIssuesList";
import { LinkSuggestions } from "./LinkSuggestions";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AnalysisResult {
  url: string;
  status: "analyzing" | "complete" | "error";
  suggestions: Array<{
    sourceUrl: string;
    targetUrl: string;
    suggestedAnchorText: string;
    relevanceScore: number;
    context: string;
    matchType?: string;
  }>;
  outboundSuggestions?: Array<any>;
  inboundSuggestions?: Array<any>;
}

interface AnalysisResultsProps {
  results: AnalysisResult;
}

const calculateLinkScore = (inboundCount: number): number => {
  // Base score calculation:
  // 0-5 links: 1-2 stars
  // 6-15 links: 3-4 stars
  // 16+ links: 5 stars
  if (inboundCount === 0) return 0;
  if (inboundCount <= 5) return Math.max(1, Math.ceil(inboundCount / 3));
  if (inboundCount <= 15) return Math.min(4, Math.ceil(inboundCount / 4));
  return 5;
};

export const AnalysisResults = ({ results }: AnalysisResultsProps) => {
  const outboundCount = results.outboundSuggestions?.length || 0;
  const inboundCount = results.inboundSuggestions?.length || 0;
  const linkScore = calculateLinkScore(inboundCount);

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
            <div className="text-sm text-muted-foreground">
              Status: {results.status === "complete" ? "Complete" : "In Progress"}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AnalysisMetricCard
              icon={ArrowDown}
              title="Links To"
              value={outboundCount}
              tooltip="Number of suggested outbound links from this page"
            />
            <AnalysisMetricCard
              icon={ArrowUp}
              title="Links From"
              value={inboundCount}
              tooltip="Number of suggested inbound links to this page"
            />
            <AnalysisMetricCard
              icon={Star}
              title="Link Score"
              value={`${linkScore}/5`}
              tooltip="Score based on the number of inbound links (higher is better)"
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <Tabs defaultValue="links-to" className="w-full">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Link Suggestions</h3>
            <TabsList>
              <TabsTrigger value="links-to">Links To</TabsTrigger>
              <TabsTrigger value="links-from">Links From</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="links-to" className="mt-0">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Suggested pages to link to from your analyzed content, based on contextual relevance.
              </p>
              {results.outboundSuggestions && results.outboundSuggestions.length > 0 ? (
                <LinkSuggestions suggestions={results.outboundSuggestions} />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No outbound link suggestions found for this content.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="links-from" className="mt-0">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Pages that should link to your analyzed content, with diversified anchor text suggestions.
              </p>
              {results.inboundSuggestions && results.inboundSuggestions.length > 0 ? (
                <LinkSuggestions suggestions={results.inboundSuggestions} />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No inbound link suggestions available yet.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </motion.div>
  );
};