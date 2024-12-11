import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
      console.error('Invalid URL provided:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid URL provided' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Sanitize domain by removing any special characters and converting to lowercase
    const domain = parsedUrl.hostname.toLowerCase().trim();
    console.log(`Processing domain: ${domain}`);
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials');
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client initialized');

    // First check if website exists
    console.log('Checking for existing website record...');
    let website;
    
    try {
      const { data: existingWebsite, error: fetchError } = await supabase
        .from('websites')
        .select()
        .eq('domain', domain)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching website:', fetchError);
        throw new Error(`Database error: ${fetchError.message}`);
      }

      if (existingWebsite) {
        console.log('Found existing website, updating last_crawled_at');
        const { data: updatedWebsite, error: updateError } = await supabase
          .from('websites')
          .update({ last_crawled_at: new Date().toISOString() })
          .eq('id', existingWebsite.id)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating website:', updateError);
          throw new Error(`Failed to update website: ${updateError.message}`);
        }
        website = updatedWebsite;
      } else {
        console.log('Creating new website record');
        const { data: newWebsite, error: createError } = await supabase
          .from('websites')
          .insert({
            domain,
            last_crawled_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating website:', createError);
          throw new Error(`Failed to create website: ${createError.message}`);
        }
        website = newWebsite;
      }

      if (!website) {
        throw new Error('Failed to get website record');
      }

      console.log('Successfully got website record:', website);

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
          const content = extractContent(doc);

          // Save page
          console.log(`Saving page: ${currentUrl}`);
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

          console.log(`Successfully saved page: ${currentUrl}`);

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
              const { error: linkError } = await supabase
                .from('links')
                .insert({
                  source_page_id: page.id,
                  anchor_text: link.textContent?.trim() || '',
                  context: extractLinkContext(link),
                  is_internal: isInternal
                });

              if (linkError) {
                console.error(`Error saving link ${href}:`, linkError);
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

      console.log('Crawl completed successfully');
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
      console.error('Error in website processing:', error);
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
