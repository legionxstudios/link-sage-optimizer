import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: corsHeaders 
    });
  }

  try {
    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error('Error parsing request body:', e);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON in request body',
          details: e.message 
        }), {
          status: 400,
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    const { url } = body;
    console.log('Starting sitemap processing for URL:', url);
    
    if (!url) {
      return new Response(
        JSON.stringify({ 
          error: 'URL is required' 
        }), {
          status: 400,
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
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
      console.error(`Failed to fetch sitemap: ${response.status} ${response.statusText}`);
      return new Response(
        JSON.stringify({ 
          error: `Failed to fetch sitemap: ${response.status} ${response.statusText}` 
        }), {
          status: response.status,
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    const xmlText = await response.text();
    console.log('Received XML content length:', xmlText.length);

    // Parse XML using deno-dom WASM parser
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    if (!xmlDoc) {
      return new Response(
        JSON.stringify({ 
          error: 'Failed to parse sitemap XML' 
        }), {
          status: 500,
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
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
      return new Response(
        JSON.stringify({ 
          error: 'Database error while processing website',
          details: websiteError 
        }), {
          status: 500,
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
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
      }), { 
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
      }), { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    );
  }
});