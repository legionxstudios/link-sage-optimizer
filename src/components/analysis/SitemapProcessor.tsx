import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "@/components/ui/use-toast";

export function SitemapProcessor() {
  const [isProcessing, setIsProcessing] = useState(false);

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
    <div className="mb-4">
      <Button 
        onClick={processSitemap}
        disabled={isProcessing}
        variant="outline"
      >
        {isProcessing ? "Processing Sitemap..." : "Process Sitemap"}
      </Button>
    </div>
  );
}