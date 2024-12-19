import { AnalysisResults } from "@/components/analysis/AnalysisResults";
import { PageIssuesList } from "@/components/analysis/PageIssuesList";
import { SitemapProcessor } from "@/components/analysis/SitemapProcessor";
import { useState } from "react";
import { AnalysisResponse } from "@/services/crawlerService";
import { AnalysisMetricCard } from "@/components/analysis/AnalysisMetricCard";
import { Link2, ArrowUpRight, ArrowDownRight, Gauge } from "lucide-react";

export default function Index() {
  const [results, setResults] = useState<AnalysisResponse | undefined>(undefined);

  // Sample issues for demonstration
  const sampleIssues = [
    {
      url: "https://example.com/page1",
      issueType: "Missing Links",
      description: "Page lacks sufficient internal links",
      impact: "Medium" as const,
      suggestedFix: "Add relevant internal links to improve navigation and SEO"
    },
    {
      url: "https://example.com/page2",
      issueType: "Broken Links",
      description: "Contains broken outbound links",
      impact: "High" as const,
      suggestedFix: "Review and update or remove broken links"
    }
  ];

  const handleAnalysisComplete = (analysisResults: AnalysisResponse) => {
    console.log("Analysis complete:", analysisResults);
    setResults(analysisResults);
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-6">Link Analysis Dashboard</h1>
        <p className="text-muted-foreground mb-4">
          Analyze your website's link structure and get recommendations for improvement.
        </p>
      </div>

      <div className="grid gap-8">
        <section>
          <h2 className="text-xl font-semibold mb-4">Process Website</h2>
          <SitemapProcessor onAnalysisComplete={handleAnalysisComplete} />
        </section>

        <section>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <AnalysisMetricCard
              icon={Link2}
              title="Total Links"
              value={results?.outboundSuggestions?.length || 0}
              tooltip="Total number of link suggestions found"
            />
            <AnalysisMetricCard
              icon={ArrowUpRight}
              title="Outbound Links"
              value={results?.outboundSuggestions?.filter(s => !s.targetUrl.includes('vendasta.com')).length || 0}
              tooltip="Number of links pointing to external websites"
            />
            <AnalysisMetricCard
              icon={ArrowDownRight}
              title="Internal Links"
              value={results?.outboundSuggestions?.filter(s => s.targetUrl.includes('vendasta.com')).length || 0}
              tooltip="Number of links pointing to pages within the website"
            />
            <AnalysisMetricCard
              icon={Gauge}
              title="Link Score"
              value={results ? "85%" : "N/A"}
              tooltip="Overall link optimization score"
            />
          </div>

          <h2 className="text-xl font-semibold mb-4">Analysis Results</h2>
          <AnalysisResults results={results} />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Page Issues</h2>
          <PageIssuesList issues={sampleIssues} />
        </section>
      </div>
    </div>
  );
}