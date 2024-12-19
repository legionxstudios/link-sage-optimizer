import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { analyzePage } from "@/services/crawlerService";

interface SitemapProcessorProps {
  onAnalysisComplete?: (results: any) => void;
}

export function SitemapProcessor({ onAnalysisComplete }: SitemapProcessorProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");

  const processSitemap = async () => {
    try {
      setIsProcessing(true);
      console.log("Starting sitemap processing");
      
      const { data, error } = await supabase.functions.invoke('process-sitemap', {
        body: { url: 'https://www.vendasta.com/sitemap.xml' }
      });

      if (error) {
        console.error("Sitemap processing error:", error);
        toast({
          title: "Error Processing Sitemap",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      console.log("Sitemap processing result:", data);
      
      // Process the first URL from the sitemap
      if (data.urls && data.urls.length > 0) {
        setCurrentUrl(data.urls[0]);
        const analysisResults = await analyzePage(data.urls[0]);
        if (onAnalysisComplete) {
          onAnalysisComplete(analysisResults);
        }
      }

      toast({
        title: "Sitemap Processed",
        description: `Successfully processed ${data.urls.length} URLs`
      });

    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button 
          onClick={processSitemap}
          disabled={isProcessing}
          variant="default"
        >
          {isProcessing ? "Processing Sitemap..." : "Process Sitemap"}
        </Button>
        {currentUrl && (
          <span className="text-sm text-muted-foreground">
            Currently analyzing: {currentUrl}
          </span>
        )}
      </div>
    </div>
  );
}