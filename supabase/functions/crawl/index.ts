import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getOrCreateWebsite } from "./db.ts";
import { crawlPage } from "./crawler.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CrawlRequest {
  url: string;
  maxPages?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, maxPages = 50 } = await req.json() as CrawlRequest;
    console.log(`Starting crawl for URL: ${url} with max pages: ${maxPages}`);

    // Validate URL
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid URL provided' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Extract domain and create/update website record
    const domain = parsedUrl.hostname;
    console.log(`Processing domain: ${domain}`);
    
    const website = await getOrCreateWebsite(domain);
    console.log(`Website record ready: ${website.id}`);

    // Initialize crawl queue and visited set
    const toVisit = new Set([url]);
    const visited = new Set<string>();

    // Start crawling
    while (toVisit.size > 0 && visited.size < maxPages) {
      const currentUrl = Array.from(toVisit)[0];
      toVisit.delete(currentUrl);

      if (visited.has(currentUrl)) continue;
      visited.add(currentUrl);

      await crawlPage(currentUrl, website.id, domain, visited, toVisit);
    }

    return new Response(
      JSON.stringify({
        success: true,
        pagesProcessed: visited.size,
        domain
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});