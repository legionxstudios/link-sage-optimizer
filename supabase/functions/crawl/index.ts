import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, maxPages = 50 } = await req.json();
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

    const domain = parsedUrl.hostname;
    console.log(`Processing domain: ${domain}`);
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create or get website record
    const { data: website, error: websiteError } = await supabase
      .from('websites')
      .upsert({
        domain,
        last_crawled_at: new Date().toISOString()
      }, {
        onConflict: 'domain'
      })
      .select()
      .single();

    if (websiteError) {
      console.error('Error creating website:', websiteError);
      throw new Error('Failed to create website record');
    }

    // Initialize crawl state
    const visited = new Set<string>();
    const toVisit = new Set([url]);
    const websiteId = website.id;

    // Start crawling
    while (toVisit.size > 0 && visited.size < maxPages) {
      const currentUrl = Array.from(toVisit)[0];
      toVisit.delete(currentUrl);

      if (visited.has(currentUrl)) continue;
      visited.add(currentUrl);

      try {
        console.log(`Crawling ${currentUrl}`);
        const response = await fetch(currentUrl);
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        if (!doc) continue;

        // Extract page content
        const title = doc.querySelector('title')?.textContent || '';
        const content = extractContent(doc);

        // Save page
        const { data: page, error: pageError } = await supabase
          .from('pages')
          .upsert({
            website_id: websiteId,
            url: currentUrl,
            title,
            content,
            last_crawled_at: new Date().toISOString()
          }, {
            onConflict: 'url'
          })
          .select()
          .single();

        if (pageError) {
          console.error(`Error saving page ${currentUrl}:`, pageError);
          continue;
        }

        // Process links
        const links = doc.querySelectorAll('a[href]');
        for (const link of links) {
          const href = link.getAttribute('href');
          if (!href) continue;

          try {
            const absoluteUrl = new URL(href, currentUrl).toString();
            const isInternal = new URL(absoluteUrl).hostname === domain;

            if (isInternal && !visited.has(absoluteUrl)) {
              toVisit.add(absoluteUrl);
            }

            // Save link
            await supabase
              .from('links')
              .insert({
                source_page_id: page.id,
                anchor_text: link.textContent?.trim() || '',
                context: extractLinkContext(link),
                is_internal: isInternal
              });

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
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error:', error);
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
  const contentSelectors = [
    'main',
    'article',
    '.content',
    '[role="main"]',
    '.post-content',
    '.entry-content'
  ];

  let content = '';
  
  for (const selector of contentSelectors) {
    const element = doc.querySelector(selector);
    if (element) {
      content = element.textContent || '';
      break;
    }
  }

  if (!content) {
    content = doc.body?.textContent || '';
  }

  return content.trim();
}

function extractLinkContext(link: Element): string {
  const parent = link.parentElement;
  if (!parent) return '';

  const context = parent.textContent || '';
  const linkText = link.textContent || '';
  
  const parts = context.split(linkText);
  if (parts.length < 2) return context;

  const before = parts[0].slice(-50).trim();
  const after = parts[1].slice(0, 50).trim();

  return `${before} [LINK] ${after}`;
}