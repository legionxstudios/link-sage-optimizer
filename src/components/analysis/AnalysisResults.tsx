import { Card } from "@/components/ui/card";
import { BarChart3, Link2, AlertTriangle } from "lucide-react";
import { AnalysisMetricCard } from "./AnalysisMetricCard";
import { PageIssuesList } from "./PageIssuesList";
import { motion } from "framer-motion";

interface AnalysisResult {
  url: string;
  totalLinks: number;
  issues: number;
  status: "analyzing" | "complete" | "error";
}

interface AnalysisResultsProps {
  results: AnalysisResult;
}

export const AnalysisResults = ({ results }: AnalysisResultsProps) => {
  // Simulated page issues for demonstration
  const pageIssues = [
    {
      url: `${results.url}/blog`,
      issueType: "Missing Internal Links",
      description: "This page has relevant content but lacks proper internal linking",
      impact: "High" as const,
      suggestedFix: "Add internal links to related product pages and category pages",
    },
    {
      url: `${results.url}/products`,
      issueType: "Cannibalized Links",
      description: "Multiple pages are using the same anchor text for different destinations",
      impact: "Medium" as const,
      suggestedFix: "Diversify anchor text to better describe each linked page's content",
    },
  ];

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
              icon={Link2}
              title="Total Links"
              value={results.totalLinks}
              tooltip="The total number of internal links found on your website"
            />
            <AnalysisMetricCard
              icon={AlertTriangle}
              title="Issues Found"
              value={results.issues}
              tooltip="Number of potential SEO issues detected in your internal linking structure"
            />
            <AnalysisMetricCard
              icon={BarChart3}
              title="Health Score"
              value={`${Math.max(0, 100 - results.issues * 10)}%`}
              tooltip="Overall health score of your internal linking structure (100% is optimal)"
            />
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Pages Requiring Attention</h4>
            <PageIssuesList issues={pageIssues} />
          </div>
        </div>
      </Card>
    </motion.div>
  );
};