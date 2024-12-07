import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { BarChart3, Link2, AlertTriangle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AnalysisResult {
  url: string;
  totalLinks: number;
  issues: number;
  status: "analyzing" | "complete" | "error";
}

const Index = () => {
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResult | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) {
      toast.error("Please enter a URL to analyze");
      return;
    }

    try {
      setIsAnalyzing(true);
      console.log("Starting analysis for:", url);
      
      // Simulate analysis for now
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setResults({
        url,
        totalLinks: Math.floor(Math.random() * 100),
        issues: Math.floor(Math.random() * 10),
        status: "complete"
      });
      
      toast.success("Analysis complete!");
    } catch (error) {
      console.error("Analysis failed:", error);
      toast.error("Failed to analyze URL");
      setResults(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-background to-background/80">
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

        {results && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="grid grid-cols-1 gap-6"
          >
            <Card className="glass-card p-6">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Analysis Results</h3>
                  <div className="text-sm text-muted-foreground">
                    Status: {results.status === "complete" ? "Complete" : "In Progress"}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card className="p-4 space-y-2 cursor-help">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Link2 className="w-4 h-4" />
                          Total Links
                        </div>
                        <div className="text-2xl font-bold">{results.totalLinks}</div>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>The total number of internal links found on your website</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card className="p-4 space-y-2 cursor-help">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <AlertTriangle className="w-4 h-4" />
                          Issues Found
                        </div>
                        <div className="text-2xl font-bold">{results.issues}</div>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Number of potential SEO issues detected in your internal linking structure</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card className="p-4 space-y-2 cursor-help">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <BarChart3 className="w-4 h-4" />
                          Health Score
                        </div>
                        <div className="text-2xl font-bold">
                          {Math.max(0, 100 - (results.issues * 10))}%
                        </div>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Overall health score of your internal linking structure (100% is optimal)</p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Tooltip>
                          <TooltipTrigger>Issue Type</TooltipTrigger>
                          <TooltipContent>
                            <p>Categories of internal linking problems detected</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead>
                        <Tooltip>
                          <TooltipTrigger>Count</TooltipTrigger>
                          <TooltipContent>
                            <p>Number of occurrences for each issue type</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead>
                        <Tooltip>
                          <TooltipTrigger>Impact</TooltipTrigger>
                          <TooltipContent>
                            <p>Severity level of the issue on your SEO performance</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger className="cursor-help">Cannibalized Links</TooltipTrigger>
                          <TooltipContent>
                            <p>Multiple pages linked with the same anchor text, potentially diluting SEO value</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>{Math.floor(results.issues / 2)}</TableCell>
                      <TableCell>
                        <span className="text-yellow-600">Medium</span>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger className="cursor-help">Missing Internal Links</TooltipTrigger>
                          <TooltipContent>
                            <p>Pages that should be linked together based on content relevance</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>{Math.ceil(results.issues / 2)}</TableCell>
                      <TableCell>
                        <span className="text-red-600">High</span>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default Index;