import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { motion } from "framer-motion";

const Index = () => {
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) {
      toast.error("Please enter a URL to analyze");
      return;
    }
    
    setIsAnalyzing(true);
    // Simulate analysis
    setTimeout(() => {
      setIsAnalyzing(false);
      toast.success("Analysis complete!");
    }, 2000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-4xl space-y-8"
      >
        <div className="text-center space-y-4">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/5 text-primary text-sm font-medium">
            Internal Link Analyzer
          </div>
          <h1 className="text-4xl font-bold tracking-tight">
            Optimize Your Internal Links
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Analyze your website's internal linking structure and get AI-powered suggestions
            for improvement.
          </p>
        </div>

        <Card className="glass-card p-6">
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Input
                type="url"
                placeholder="Enter your website URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={isAnalyzing}>
                {isAnalyzing ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analyzing...
                  </div>
                ) : (
                  "Analyze Links"
                )}
              </Button>
            </div>
          </form>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="glass-card p-6 space-y-4">
            <h3 className="text-lg font-semibold">Link Distribution</h3>
            <div className="h-48 flex items-center justify-center border rounded-lg">
              <p className="text-muted-foreground">Visualization coming soon</p>
            </div>
          </Card>

          <Card className="glass-card p-6 space-y-4">
            <h3 className="text-lg font-semibold">Quick Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-primary/5">
                <div className="text-sm text-muted-foreground">Total Links</div>
                <div className="text-2xl font-bold">0</div>
              </div>
              <div className="p-4 rounded-lg bg-primary/5">
                <div className="text-sm text-muted-foreground">Issues Found</div>
                <div className="text-2xl font-bold">0</div>
              </div>
            </div>
          </Card>
        </div>
      </motion.div>
    </div>
  );
};

export default Index;