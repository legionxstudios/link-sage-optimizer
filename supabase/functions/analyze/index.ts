import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractContent } from "./content-extractor.ts";
import { processSitemap } from "./sitemap-processor.ts";

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
    console.log('Received URL:', url);

    if (!url || typeof url !== 'string') {
      throw new Error('Valid URL is required');
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Extract domain from URL
    const domain = new URL(url).hostname;
    console.log('Processing domain:', domain);

    // Check if this domain has been crawled before
    const { data: existingWebsite } = await supabase
      .from('websites')
      .select('id, last_crawled_at')
      .eq('domain', domain)
      .single();

    // If domain hasn't been crawled or was crawled more than a week ago
    if (!existingWebsite || 
        !existingWebsite.last_crawled_at || 
        new Date(existingWebsite.last_crawled_at).getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000) {
      console.log('Domain needs indexing, checking for sitemap...');
      
      // Try common sitemap locations
      const sitemapUrls = [
        `https://${domain}/sitemap.xml`,
        `https://${domain}/sitemap_index.xml`,
        `https://${domain}/wp-sitemap.xml`,
        `https://${domain}/sitemap/sitemap.xml`
      ];

      let sitemapFound = false;
      for (const sitemapUrl of sitemapUrls) {
        try {
          const response = await fetch(sitemapUrl);
          if (response.ok) {
            console.log('Found sitemap at:', sitemapUrl);
            await processSitemap(sitemapUrl, supabase);
            sitemapFound = true;
            break;
          }
        } catch (e) {
          console.log(`No sitemap found at ${sitemapUrl}`);
        }
      }

      // If no sitemap found, initiate crawl
      if (!sitemapFound) {
        console.log('No sitemap found, initiating crawl...');
        const { data: crawlResponse, error: crawlError } = await supabase.functions.invoke('crawl', {
          body: { url, maxPages: 100 }
        });

        if (crawlError) {
          console.error('Error during crawl:', crawlError);
          throw new Error(`Crawl failed: ${crawlError.message}`);
        }

        console.log('Crawl completed:', crawlResponse);
      }
    }

    // Get relevant pages from database for suggestions
    const { data: relevantPages } = await supabase
      .from('pages')
      .select('url, title, content')
      .eq('website_id', existingWebsite?.id)
      .neq('url', url)
      .limit(50);

    console.log(`Found ${relevantPages?.length || 0} relevant pages for suggestions`);

    // Extract content and generate suggestions
    const mainContent = await extractContent(url);
    const suggestions = relevantPages?.map(page => ({
      suggestedAnchorText: page.title || new URL(page.url).pathname,
      context: page.content?.substring(0, 200) || '',
      matchType: 'page_based',
      relevanceScore: 0.8,
      targetUrl: page.url,
      targetTitle: page.title
    })) || [];

    return new Response(
      JSON.stringify({
        suggestions,
        pagesAnalyzed: relevantPages?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analysis:', error);
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