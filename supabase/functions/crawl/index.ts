import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CrawlRequest {
  url: string;
  maxPages?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, maxPages = 50 } = await req.json() as CrawlRequest;
    console.log(`Starting crawl for URL: ${url} with max pages: ${maxPages}`);

    // Validate URL
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid URL provided' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Extract domain more safely using URL API
    const domain = parsedUrl.hostname;
    console.log(`Extracted domain: ${domain}`);

    // Create or update website record
    const { data: website, error: websiteError } = await supabase
      .from('websites')
      .upsert({ 
        domain, 
        last_crawled_at: new Date().toISOString() 
      })
      .select()
      .single();

    if (websiteError) {
      console.error('Website upsert error:', websiteError);
      return new Response(
        JSON.stringify({ error: 'Failed to create website record' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    console.log(`Website record created/updated: ${website.id}`);

    // Initialize crawl queue and visited set
    const toVisit = new Set([url]);
    const visited = new Set<string>();
    const pageMap = new Map<string, { id: string; title: string; content: string }>();

    while (toVisit.size > 0 && visited.size < maxPages) {
      const currentUrl = Array.from(toVisit)[0];
      toVisit.delete(currentUrl);

      if (visited.has(currentUrl)) continue;
      visited.add(currentUrl);

      try {
        console.log(`Crawling: ${currentUrl}`);
        const response = await fetch(currentUrl);
        if (!response.ok) {
          console.warn(`Failed to fetch ${currentUrl}: ${response.status}`);
          continue;
        }

        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        
        if (!doc) {
          console.warn(`Failed to parse HTML for ${currentUrl}`);
          continue;
        }

        // Extract page content
        const title = doc.querySelector('title')?.textContent || '';
        const mainContent = doc.querySelector('main, article, .content, [role="main"]')?.textContent || 
                          doc.body?.textContent || '';
        
        // Store page in database
        const { data: page, error: pageError } = await supabase
          .from('pages')
          .upsert({
            website_id: website.id,
            url: currentUrl,
            title,
            content: mainContent,
            last_crawled_at: new Date().toISOString()
          })
          .select()
          .single();

        if (pageError) {
          console.error('Page upsert error:', pageError);
          continue;
        }

        pageMap.set(currentUrl, page);

        // Extract and process links
        const links = Array.from(doc.querySelectorAll('a[href]'));
        for (const link of links) {
          const href = link.getAttribute('href');
          if (!href) continue;

          try {
            const absoluteUrl = new URL(href, currentUrl).toString();
            const isInternal = new URL(absoluteUrl).hostname === domain;
            
            if (isInternal && !visited.has(absoluteUrl)) {
              toVisit.add(absoluteUrl);
            }

            // Store link in database
            const { error: linkError } = await supabase
              .from('links')
              .upsert({
                source_page_id: page.id,
                anchor_text: link.textContent?.trim(),
                context: link.parentElement?.textContent?.trim(),
                is_internal: isInternal,
                url: absoluteUrl
              })
              .select();

            if (linkError) {
              console.error('Link upsert error:', linkError);
            }

          } catch (e) {
            console.error(`Error processing link ${href}:`, e);
          }
        }

        // Small delay to be nice to the server
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (e) {
        console.error(`Error crawling ${currentUrl}:`, e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        pagesProcessed: visited.size,
        domain
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});