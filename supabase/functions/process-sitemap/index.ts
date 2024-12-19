import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, createErrorResponse, createSuccessResponse } from "./utils/cors.ts";
import { fetchAndParseSitemap } from "./utils/sitemap-parser.ts";
import { processUrlsInDatabase } from "./utils/db-operations.ts";

serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Parse request body with better error handling
    let body;
    try {
      const text = await req.text();
      console.log('Received request body:', text); // Log the raw request body
      body = JSON.parse(text);
    } catch (e) {
      console.error('Error parsing request body:', e);
      return createErrorResponse('Invalid JSON in request body', e.message);
    }

    const { url } = body;
    console.log('Starting sitemap processing for URL:', url);
    
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
      // Fetch and parse sitemap
      const urls = await fetchAndParseSitemap(url);
      console.log(`Found ${urls.length} URLs in sitemap`);

      // Process URLs in database
      const domain = new URL(url).hostname;
      const processedUrls = await processUrlsInDatabase(domain, urls);

      return createSuccessResponse({ 
        success: true, 
        message: `Processed ${processedUrls.length} URLs from sitemap`,
        urls: processedUrls 
      });

    } catch (error) {
      console.error('Error processing sitemap:', error);
      return createErrorResponse(
        error.message,
        { stack: error.stack },
        500
      );
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    return createErrorResponse(
      'Internal server error',
      { message: error.message, stack: error.stack },
      500
    );
  }
});