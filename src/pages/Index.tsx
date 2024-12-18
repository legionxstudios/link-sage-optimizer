import { AnalysisResults } from "@/components/analysis/AnalysisResults";
import { SitemapProcessor } from "@/components/analysis/SitemapProcessor";
import { useState } from "react";
import { AnalysisResponse } from "@/services/crawlerService";

export default function Index() {
  const [results, setResults] = useState<AnalysisResponse | undefined>(undefined);

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Link Analysis</h1>
      <SitemapProcessor />
      <AnalysisResults results={results} />
    </div>
  );
}