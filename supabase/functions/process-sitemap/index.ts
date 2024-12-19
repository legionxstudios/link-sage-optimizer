import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { fetchAndParseSitemap } from "./utils/sitemap-parser.ts";
import { processUrlsInDatabase } from "./utils/db-operations.ts";
import { corsHeaders } from "./utils/cors.ts";

console.log("Process sitemap function started");

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get and validate the request body
    const requestData = await req.json().catch(() => null);
    console.log('Received request data:', requestData);

    if (!requestData || !requestData.url) {
      console.error('Invalid or empty request body received');
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request body', 
          details: 'URL is required in the request body' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { url } = requestData;

    try {
      new URL(url);
    } catch (e) {
      console.error('Invalid URL format:', url);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid URL format', 
          details: e.message 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Starting sitemap fetch and parse for:', url);
    const urls = await fetchAndParseSitemap(url);
    console.log(`Successfully found ${urls.length} URLs in sitemap or page`);

    if (urls.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No URLs found',
          details: 'Could not find any valid URLs in the sitemap or page content.'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Process URLs in database
    const domain = new URL(url).hostname;
    console.log('Processing URLs for domain:', domain);
    const processedUrls = await processUrlsInDatabase(domain, urls);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${processedUrls.length} URLs from sitemap or page content`,
        urls: processedUrls 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error processing sitemap:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process sitemap', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});