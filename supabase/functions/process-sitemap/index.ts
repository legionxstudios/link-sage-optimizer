import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { fetchAndParseSitemap } from "./utils/sitemap-parser.ts";
import { processUrlsInDatabase } from "./utils/db-operations.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const text = await req.text();
    console.log('Raw request body:', text);
    
    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Request body is empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    let requestBody;
    try {
      requestBody = JSON.parse(text);
      console.log('Parsed request body:', requestBody);
    } catch (e) {
      console.error('Error parsing request body:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body', details: e.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { url } = requestBody;
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      new URL(url);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid URL format', details: e.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting sitemap fetch and parse for:', url);
    const urls = await fetchAndParseSitemap(url);
    console.log(`Successfully found ${urls.length} URLs in sitemap`);

    if (urls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No URLs found in sitemap' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process URLs in database
    const domain = new URL(url).hostname;
    console.log('Processing URLs for domain:', domain);
    const processedUrls = await processUrlsInDatabase(domain, urls);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${processedUrls.length} URLs from sitemap`,
        urls: processedUrls 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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