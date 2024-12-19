import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

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
    console.log('Starting sitemap processing for URL:', url);
    
    if (!url) {
      throw new Error('URL is required');
    }

    // Try to find sitemap.xml
    const sitemapUrl = new URL('/sitemap.xml', url).toString();
    console.log('Attempting to fetch sitemap from:', sitemapUrl);

    const response = await fetch(sitemapUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LovableCrawler/1.0)',
        'Accept': 'text/xml, application/xml'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch sitemap: ${response.status} ${response.statusText}`);
    }

    const xmlText = await response.text();
    console.log('Received XML content length:', xmlText.length);

    // Parse XML using deno-dom WASM parser
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/html');
    
    if (!xmlDoc) {
      throw new Error('Failed to parse sitemap XML');
    }

    // Extract URLs from <url><loc> tags
    const urlElements = xmlDoc.getElementsByTagName('url');
    const urls = Array.from(urlElements).map(urlElement => {
      const locElement = urlElement.getElementsByTagName('loc')[0];
      const lastmodElement = urlElement.getElementsByTagName('lastmod')[0];
      return {
        url: locElement?.textContent || '',
        lastModified: lastmodElement?.textContent || null
      };
    }).filter(entry => entry.url);

    console.log(`Found ${urls.length} URLs in sitemap`);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get domain from URL
    const domain = new URL(url).hostname;
    console.log('Processing domain:', domain);

    // Use upsert for the website
    const { data: website, error: websiteError } = await supabase
      .from('websites')
      .upsert(
        {
          domain,
          last_crawled_at: new Date().toISOString()
        },
        {
          onConflict: 'domain'
        }
      )
      .select()
      .single();

    if (websiteError) {
      console.error('Error upserting website record:', websiteError);
      throw websiteError;
    }

    console.log('Website record created/updated:', website);

    // Insert pages
    const processedUrls = [];
    for (const pageUrl of urls) {
      try {
        const { error: pageError } = await supabase
          .from('pages')
          .upsert({
            website_id: website.id,
            url: pageUrl.url,
            last_crawled_at: null
          }, {
            onConflict: 'url'
          });

        if (pageError) {
          console.error(`Error upserting page ${pageUrl.url}:`, pageError);
        } else {
          console.log(`Successfully queued page for crawling: ${pageUrl.url}`);
          processedUrls.push(pageUrl.url);
        }
      } catch (error) {
        console.error(`Error processing URL ${pageUrl.url}:`, error);
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
    console.error('Error processing sitemap:', error);
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