import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parse } from "https://deno.land/x/xml@2.1.1/mod.ts";
import { logger } from "./utils/logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      throw new Error('URL is required');
    }

    logger.info(`Processing sitemap for URL: ${url}`);
    
    // Extract domain from URL
    const domain = new URL(url).hostname;
    
    // Get or create website record using upsert
    const { data: website, error: websiteError } = await supabase
      .from('websites')
      .upsert({ 
        domain,
        last_crawled_at: new Date().toISOString()
      }, {
        onConflict: 'domain',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (websiteError) {
      logger.error('Error upserting website:', websiteError);
      throw websiteError;
    }

    logger.info(`Website record created/updated for domain: ${domain}`);

    // Fetch the sitemap
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch sitemap: ${response.status} ${response.statusText}`);
    }

    const sitemapText = await response.text();
    logger.info(`Sitemap content length: ${sitemapText.length}`);

    // Parse XML using Deno's XML parser
    const xmlDoc = parse(sitemapText);
    const urls = xmlDoc.urlset?.url ?? [];
    const processedUrls = [];

    logger.info(`Found ${urls.length} URLs in sitemap`);
    
    for (const urlElement of urls) {
      const loc = urlElement.loc?.[0];
      const lastmod = urlElement.lastmod?.[0];
      
      if (!loc) {
        logger.warn('Skipping URL element without location');
        continue;
      }

      try {
        // Store page in database using upsert
        const { data: page, error: pageError } = await supabase
          .from('pages')
          .upsert({
            website_id: website.id,
            url: loc,
            last_crawled_at: lastmod || new Date().toISOString()
          }, {
            onConflict: 'url',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (pageError) {
          logger.error(`Error upserting page ${loc}:`, pageError);
          continue;
        }

        processedUrls.push({
          url: loc,
          lastModified: lastmod
        });

        logger.info(`Successfully processed URL: ${loc}`);

      } catch (error) {
        logger.error(`Error processing URL ${loc}:`, error);
        continue;
      }
    }

    logger.info(`Successfully processed ${processedUrls.length} URLs`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${processedUrls.length} URLs from sitemap`,
        urls: processedUrls 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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