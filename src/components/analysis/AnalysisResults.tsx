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
  pageContents?: Array<{
    url: string;
    title: string;
    content: string;
    mainKeywords: string[];
    internalLinksCount?: number;
    externalLinksCount?: number;
  }>;
  outboundSuggestions?: Array<any>;
  inboundSuggestions?: Array<any>;
  linkScore?: number;
}

interface AnalysisResultsProps {
  results: AnalysisResult;
}

export const AnalysisResults = ({ results }: AnalysisResultsProps) => {
  console.log("Raw analysis results:", results);

  // Add null checks and default values
  const pageContent = results.pageContents?.[0] || {};
  const internalLinks = pageContent?.internalLinksCount || 0;
  const externalLinks = pageContent?.externalLinksCount || 0;
  const totalOutbound = internalLinks + externalLinks;
  const totalInbound = results.inboundSuggestions?.length || 0;
  const linkScore = results.linkScore || 0;

  console.log("Processed analysis data:", {
    pageContent,
    internalLinks,
    externalLinks,
    totalOutbound,
    totalInbound,
    linkScore
  });

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
              value={totalOutbound}
              tooltip="Total number of outbound links (internal + external) on this page"
            />
            <AnalysisMetricCard
              icon={ArrowUp}
              title="Links From"
              value={totalInbound}
              tooltip="Number of suggested inbound links to this page"
            />
            <AnalysisMetricCard
              icon={Star}
              title="Link Score"
              value={`${linkScore}/5`}
              tooltip="Overall link quality score based on quantity and balance of internal/external links"
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