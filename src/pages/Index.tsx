import { AnalysisResults } from "@/components/analysis/AnalysisResults";
import { SitemapProcessor } from "@/components/analysis/SitemapProcessor";

export default function Index() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Link Analysis</h1>
      <SitemapProcessor />
      <AnalysisResults />
    </div>
  );
}