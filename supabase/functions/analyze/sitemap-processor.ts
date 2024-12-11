import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function processSitemap(sitemapUrl: string, supabase: any) {
  console.log('Processing sitemap:', sitemapUrl);
  
  try {
    const response = await fetch(sitemapUrl);
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    if (!xmlDoc) {
      throw new Error('Failed to parse sitemap XML');
    }

    // Get domain from sitemap URL
    const domain = new URL(sitemapUrl).hostname;

    // Get or create website record
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

    if (websiteError) throw websiteError;

    // Process URLs from sitemap
    const urls = xmlDoc.getElementsByTagName('url');
    console.log(`Found ${urls.length} URLs in sitemap`);
    
    for (const url of urls) {
      const loc = url.getElementsByTagName('loc')[0]?.textContent;
      if (!loc) continue;

      try {
        // Save page record
        await supabase
          .from('pages')
          .upsert({
            website_id: website.id,
            url: loc,
            last_crawled_at: new Date().toISOString()
          }, {
            onConflict: 'url'
          });

      } catch (error) {
        console.error(`Error processing URL ${loc}:`, error);
      }
    }

    console.log(`Successfully processed ${urls.length} URLs from sitemap`);
    return urls.length;
    
  } catch (error) {
    console.error('Error processing sitemap:', error);
    throw error;
  }
}