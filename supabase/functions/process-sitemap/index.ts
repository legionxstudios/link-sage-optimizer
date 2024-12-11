import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { sitemapUrl } = await req.json()
    console.log('Processing sitemap:', sitemapUrl)

    if (!sitemapUrl) {
      throw new Error('Sitemap URL is required')
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Extract domain from sitemap URL
    const domain = new URL(sitemapUrl).hostname
    console.log('Domain:', domain)

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
      .single()

    if (websiteError) {
      throw websiteError
    }

    // Fetch and parse sitemap
    console.log('Fetching sitemap...')
    const response = await fetch(sitemapUrl)
    const xmlText = await response.text()
    
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml')
    
    if (!xmlDoc) {
      throw new Error('Failed to parse sitemap XML')
    }

    // Process URLs from sitemap
    const urls = xmlDoc.getElementsByTagName('url')
    const processedUrls = []
    
    console.log(`Found ${urls.length} URLs in sitemap`)
    
    for (const url of urls) {
      const loc = url.getElementsByTagName('loc')[0]?.textContent
      if (!loc) continue

      try {
        // Save page record
        const { data: page, error: pageError } = await supabase
          .from('pages')
          .upsert({
            website_id: website.id,
            url: loc,
            last_crawled_at: new Date().toISOString()
          }, {
            onConflict: 'url'
          })
          .select()
          .single()

        if (pageError) {
          console.error(`Error saving page ${loc}:`, pageError)
          continue
        }

        processedUrls.push(loc)
      } catch (error) {
        console.error(`Error processing URL ${loc}:`, error)
      }
    }

    console.log(`Successfully processed ${processedUrls.length} URLs`)
    
    return new Response(
      JSON.stringify({
        success: true,
        processedUrls: processedUrls.length,
        domain
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error processing sitemap:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})