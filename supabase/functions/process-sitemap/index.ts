import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logger } from "./utils/logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    logger.info('Starting sitemap processing for URL:', url);
    
    if (!url) {
      logger.error('No URL provided');
      throw new Error('URL is required');
    }

    // Try to find sitemap.xml first
    const sitemapUrl = new URL('/sitemap.xml', url).toString();
    logger.info('Attempting to fetch sitemap from:', sitemapUrl);

    const response = await fetch(sitemapUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LovableCrawler/1.0)'
      }
    });

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

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get domain from URL
    const domain = new URL(url).hostname;
    logger.info('Processing domain:', domain);

    // Create website record
    const { data: website, error: websiteError } = await supabase
      .from('websites')
      .upsert({
        domain,
        last_crawled_at: new Date().toISOString()
      })
      .select()
      .single();

    if (websiteError) {
      logger.error('Error creating website record:', websiteError);
      throw websiteError;
    }

    logger.info('Website record created/updated:', website);

    // Insert pages
    const processedUrls = [];
    for (const pageUrl of urls) {
      try {
        const { error: pageError } = await supabase
          .from('pages')
          .upsert({
            website_id: website.id,
            url: pageUrl.url,
            last_crawled_at: null // Set to null so crawler will pick it up
          });

        if (pageError) {
          logger.error(`Error inserting page ${pageUrl.url}:`, pageError);
        } else {
          logger.info(`Successfully queued page for crawling: ${pageUrl.url}`);
          processedUrls.push(pageUrl.url);
        }
      } catch (error) {
        logger.error(`Error processing URL ${pageUrl.url}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${processedUrls.length} URLs from sitemap`,
        urls: processedUrls 
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