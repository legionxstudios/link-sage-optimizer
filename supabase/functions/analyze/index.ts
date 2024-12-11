import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { extractContent } from "./content-analyzer.ts"
import { extractKeywords } from "./keyword-extractor.ts"
import { generateSEOSuggestions } from "./modules/suggestion-generator.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.3"
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting page analysis...')
    const { url } = await req.json()
    console.log('Received URL:', url)

    if (!url || typeof url !== 'string') {
      console.error('Invalid URL provided')
      throw new Error('Valid URL is required')
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Extract domain from URL
    const domain = new URL(url).hostname
    console.log('Processing domain:', domain)

    // Check if this domain has been crawled before
    const { data: existingWebsite } = await supabase
      .from('websites')
      .select('id, last_crawled_at')
      .eq('domain', domain)
      .single()

    // If domain hasn't been crawled or was crawled more than a week ago, trigger crawl
    if (!existingWebsite || 
        !existingWebsite.last_crawled_at || 
        new Date(existingWebsite.last_crawled_at).getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000) {
      console.log('Domain needs crawling, initiating crawl...')
      
      // Trigger crawl function
      const { data: crawlResponse, error: crawlError } = await supabase.functions.invoke('crawl', {
        body: { url, maxPages: 50 }
      })

      if (crawlError) {
        console.error('Error during crawl:', crawlError)
        throw new Error(`Crawl failed: ${crawlError.message}`)
      }

      console.log('Crawl completed:', crawlResponse)
    } else {
      console.log('Domain already crawled recently')
    }

    // Extract content and analyze
    console.log('Extracting content from URL:', url)
    const { title, content, links } = await extractContent(url)
    console.log('Content extracted:', { 
      title, 
      contentLength: content.length,
      linksCount: links?.length || 0,
      contentPreview: content.substring(0, 100) + '...' 
    })

    if (!content || content.length < 10) {
      console.error('Extracted content is too short or empty')
      throw new Error('Could not extract meaningful content from URL')
    }

    console.log('Extracting keywords...')
    const keywords = await extractKeywords(content)
    console.log('Keywords extracted:', keywords)

    if (!keywords.exact_match || keywords.exact_match.length === 0) {
      console.warn('No exact match keywords found')
    }

    console.log('Generating SEO suggestions...')
    const suggestions = await generateSEOSuggestions(content, keywords.exact_match, url)
    console.log('Generated suggestions:', suggestions)

    // Save analysis results
    try {
      console.log('Saving analysis results...')
      const { error: analysisError } = await supabase
        .from('page_analysis')
        .upsert({
          url: url,
          title: title,
          content: content,
          main_keywords: keywords.exact_match,
          seo_keywords: keywords,
          suggestions: suggestions,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'url'
        })

      if (analysisError) {
        console.error('Error saving analysis:', analysisError)
        throw analysisError
      }
      console.log('Analysis results saved successfully')

    } catch (dbError) {
      console.error('Database operation failed:', dbError)
      throw new Error(`Database operation failed: ${dbError.message}`)
    }

    const analysisResult = {
      keywords,
      outboundSuggestions: suggestions
    }

    console.log('Analysis completed successfully')
    return new Response(
      JSON.stringify(analysisResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in analysis:', error)
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