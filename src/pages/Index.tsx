import { AnalysisResults } from "@/components/analysis/AnalysisResults";
import { PageIssuesList } from "@/components/analysis/PageIssuesList";
import { SitemapProcessor } from "@/components/analysis/SitemapProcessor";
import { useState } from "react";
import { AnalysisResponse } from "@/services/crawlerService";

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
          <SitemapProcessor />
        </section>

        <section>
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