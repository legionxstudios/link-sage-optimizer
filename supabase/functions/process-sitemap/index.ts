import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logger } from "./utils/logger.ts";

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
    logger.info('Starting sitemap processing');
    const { url } = await req.json();
    
    if (!url) {
      logger.error('No URL provided');
      throw new Error('URL is required');
    }

    logger.info(`Processing sitemap for URL: ${url}`);

    // Fetch the sitemap
    const response = await fetch(url);
    if (!response.ok) {
      logger.error(`Failed to fetch sitemap: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to fetch sitemap: ${response.status} ${response.statusText}`);
    }

    const sitemapText = await response.text();
    logger.info(`Sitemap content length: ${sitemapText.length}`);

    // Parse the XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(sitemapText, "text/xml");
    
    if (!xmlDoc) {
      logger.error('Failed to parse sitemap XML');
      throw new Error('Failed to parse sitemap XML');
    }

    // Extract URLs
    const urls = Array.from(xmlDoc.getElementsByTagName('url'))
      .map(urlElement => {
        const loc = urlElement.getElementsByTagName('loc')[0]?.textContent;
        const lastmod = urlElement.getElementsByTagName('lastmod')[0]?.textContent;
        return { url: loc, lastModified: lastmod };
      })
      .filter(entry => entry.url);

    logger.info(`Found ${urls.length} URLs in sitemap`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${urls.length} URLs from sitemap`,
        urls: urls 
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    );

  } catch (error) {
    logger.error('Error processing sitemap:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});