import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
    logger.info('Starting crawler');

    // Get uncrawled pages
    const { data: pages, error: pagesError } = await supabase
      .from('pages')
      .select('*')
      .is('last_crawled_at', null)
      .limit(10);

    if (pagesError) {
      logger.error('Error fetching pages:', pagesError);
      throw pagesError;
    }

    logger.info(`Found ${pages?.length || 0} pages to crawl`);

    if (!pages || pages.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pages to crawl' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];
    for (const page of pages) {
      try {
        logger.info(`Crawling page: ${page.url}`);
        
        const response = await fetch(page.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; LovableCrawler/1.0; +http://example.com/bot)'
          }
        });

        if (!response.ok) {
          logger.error(`Failed to fetch ${page.url}: ${response.status} ${response.statusText}`);
          continue;
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Extract content
        const title = doc.querySelector('title')?.textContent || '';
        const content = extractContent(doc);
        
        logger.info(`Extracted content from ${page.url}, length: ${content.length}`);

        // Update page record
        const { error: updateError } = await supabase
          .from('pages')
          .update({
            title,
            content,
            last_crawled_at: new Date().toISOString()
          })
          .eq('id', page.id);

        if (updateError) {
          logger.error(`Error updating page ${page.url}:`, updateError);
          continue;
        }

        results.push({
          url: page.url,
          title,
          contentLength: content.length
        });

        logger.info(`Successfully processed ${page.url}`);

      } catch (error) {
        logger.error(`Error processing page ${page.url}:`, error);
        continue;
      }
    }

    logger.info(`Crawling completed. Processed ${results.length} pages`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Processed ${results.length} pages`,
        results 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    logger.error('Crawler error:', error);
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

function extractContent(doc: Document): string {
  // Remove non-content elements
  ['script', 'style', 'noscript', 'iframe'].forEach(tag => {
    doc.querySelectorAll(tag).forEach(el => el.remove());
  });

  // Get main content
  const content = doc.body?.textContent || '';
  return content.trim();
}