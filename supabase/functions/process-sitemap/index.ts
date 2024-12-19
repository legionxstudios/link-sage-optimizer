import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { fetchAndParseSitemap } from "./utils/sitemap-parser.ts";
import { processUrlsInDatabase } from "./utils/db-operations.ts";
import { corsHeaders, handleCors, createResponse } from "./utils/cors.ts";

console.log("Process sitemap function started");

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return createResponse({ error: 'Method not allowed' }, 405);
    }

    // Get the request body
    const text = await req.text();
    console.log('Raw request body:', text);
    
    if (!text) {
      console.error('Empty request body received');
      return createResponse(
        { error: 'Request body is empty' },
        400
      );
    }
    
    let requestBody;
    try {
      requestBody = JSON.parse(text);
      console.log('Parsed request body:', requestBody);
    } catch (e) {
      console.error('Error parsing request body:', e);
      return createResponse(
        { error: 'Invalid JSON in request body', details: e.message },
        400
      );
    }

    const { url } = requestBody;
    if (!url) {
      console.error('No URL provided in request body');
      return createResponse(
        { error: 'URL is required' },
        400
      );
    }

    try {
      new URL(url);
    } catch (e) {
      console.error('Invalid URL format:', url);
      return createResponse(
        { error: 'Invalid URL format', details: e.message },
        400
      );
    }

    console.log('Starting sitemap fetch and parse for:', url);
    const urls = await fetchAndParseSitemap(url);
    console.log(`Successfully found ${urls.length} URLs in sitemap or page`);

    if (urls.length === 0) {
      return createResponse(
        { 
          error: 'No URLs found',
          details: 'Could not find any valid URLs in the sitemap or page content.'
        },
        400
      );
    }

    // Process URLs in database
    const domain = new URL(url).hostname;
    console.log('Processing URLs for domain:', domain);
    const processedUrls = await processUrlsInDatabase(domain, urls);

    return createResponse({ 
      success: true, 
      message: `Processed ${processedUrls.length} URLs from sitemap or page content`,
      urls: processedUrls 
    });

  } catch (error) {
    console.error('Error processing sitemap:', error);
    return createResponse({ 
      error: 'Failed to process sitemap', 
      details: error.message 
    }, 500);
  }
});