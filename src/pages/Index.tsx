import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { AnalysisResults } from "@/components/analysis/AnalysisResults";
import { analyzePage, AnalysisResponse } from "@/services/crawlerService";

const Index = () => {
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResponse | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) {
      toast.error("Please enter a URL to analyze");
      return;
    }

    try {
      new URL(url);
    } catch (e) {
      toast.error("Please enter a valid URL (including http:// or https://)");
      return;
    }

    try {
      setIsAnalyzing(true);
      toast.info("Analyzing content...");
      console.log("Starting analysis for:", url);
      
      const analysisResults = await analyzePage(url);
      console.log("Analysis completed:", analysisResults);
      
      setResults(analysisResults);
      toast.success("Analysis complete!");
    } catch (error: any) {
      console.error("Process failed:", error);
      toast.error(error.message || "Failed to process URL. Please try again.");
      setResults(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen p-6 bg-gradient-to-b from-background to-background/80">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-5xl mx-auto space-y-8"
      >
        <div className="text-center space-y-4">
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-accent/20 text-primary text-sm font-medium">
            Link Sage Optimizer
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            Get Smart Link Suggestions
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Analyze your content and get AI-powered suggestions for relevant outbound links.
          </p>
        </div>

        <Card className="glass-card p-8">
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Input
                type="url"
                placeholder="Enter your page URL (e.g., https://example.com/page)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 h-12 rounded-xl bg-white/50 border-white/20 backdrop-blur-sm"
              />
              <Button 
                type="submit" 
                disabled={isAnalyzing}
                className="h-12 px-8 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
              >
                {isAnalyzing ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Analyzing...
                  </div>
                ) : (
                  "Analyze Content"
                )}
              </Button>
            </div>
          </form>
        </Card>

        <AnalysisResults results={results} />
      </motion.div>
    </div>
  );
};

export default Index;