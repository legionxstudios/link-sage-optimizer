import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, createErrorResponse, createSuccessResponse } from "./utils/cors.ts";
import { fetchAndParseSitemap } from "./utils/sitemap-parser.ts";
import { processUrlsInDatabase } from "./utils/db-operations.ts";

serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Parse request body
    let requestBody;
    try {
      const text = await req.text();
      console.log('Raw request body:', text);
      
      if (!text) {
        return createErrorResponse('Request body is empty');
      }
      
      requestBody = JSON.parse(text);
      console.log('Parsed request body:', requestBody);
    } catch (e) {
      console.error('Error parsing request body:', e);
      return createErrorResponse('Invalid JSON in request body', e.message);
    }

    const { url } = requestBody;
    console.log('Processing URL:', url);
    
    if (!url) {
      return createErrorResponse('URL is required');
    }

    try {
      // Validate URL format
      new URL(url);
    } catch (e) {
      return createErrorResponse('Invalid URL format', e.message);
    }

    try {
      // Fetch and parse sitemap with enhanced error handling
      console.log('Starting sitemap fetch and parse for:', url);
      const urls = await fetchAndParseSitemap(url);
      console.log(`Successfully found ${urls.length} URLs in sitemap`);

      if (urls.length === 0) {
        return createErrorResponse('No URLs found in sitemap');
      }

      // Process URLs in database
      const domain = new URL(url).hostname;
      console.log('Processing URLs for domain:', domain);
      const processedUrls = await processUrlsInDatabase(domain, urls);

      return createSuccessResponse({ 
        success: true, 
        message: `Processed ${processedUrls.length} URLs from sitemap`,
        urls: processedUrls 
      });

    } catch (error) {
      console.error('Error processing sitemap:', error);
      return createErrorResponse(
        'Failed to process sitemap',
        { message: error.message },
        500
      );
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    return createErrorResponse(
      'Internal server error',
      { message: error.message },
      500
    );
  }
});