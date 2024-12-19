import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
import { analyzeWithOpenAI } from "./utils/openai.ts";
import { extractContent } from "./utils/content-extractor.ts";
import { logger } from "./utils/logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: corsHeaders 
    });
  }

  try {
    const { url } = await req.json();
    logger.info('Starting analysis for:', url);

    if (!url) {
      throw new Error('URL is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch page content with retries
    let response;
    let retries = 3;
    while (retries > 0) {
      try {
        logger.info(`Attempting to fetch URL (${4-retries}/3):`, url);
        response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; LovableCrawler/1.0)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
          redirect: 'follow',
        });
        
        if (response.ok) {
          logger.info('Successfully fetched URL');
          break;
        }
        
        logger.warn(`Fetch attempt failed with status ${response.status}, retries left: ${retries-1}`);
        retries--;
        if (retries > 0) await new Promise(r => setTimeout(r, 1000 * (4-retries)));
      } catch (error) {
        logger.error(`Fetch attempt failed (${retries} retries left):`, error);
        retries--;
        if (retries === 0) throw error;
        await new Promise(r => setTimeout(r, 1000 * (4-retries)));
      }
    }

    if (!response?.ok) {
      throw new Error(`Failed to fetch page: ${response?.status}`);
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (!doc) {
      throw new Error('Failed to parse webpage');
    }

    // Extract content
    const title = doc.querySelector('title')?.textContent || '';
    const content = extractContent(doc);
    logger.info('Extracted content length:', content.length);

    // Get website domain
    const domain = new URL(url).hostname;

    // Get website ID or create new website
    const { data: website, error: websiteError } = await supabase
      .from('websites')
      .upsert({ domain })
      .select('id')
      .single();

    if (websiteError) {
      throw websiteError;
    }

    // Get existing pages from the same website
    const { data: existingPages } = await supabase
      .from('pages')
      .select('url, title, content')
      .eq('website_id', website.id)
      .neq('url', url);

    // Analyze with OpenAI
    const analysis = await analyzeWithOpenAI(content, existingPages || []);

    // Store analysis results
    const { error: analysisError } = await supabase
      .from('page_analysis')
      .upsert({
        url,
        title,
        content,
        main_keywords: analysis.keywords?.exact_match || [],
        seo_keywords: analysis.keywords || {},
        suggestions: analysis.outboundSuggestions || [],
        created_at: new Date().toISOString()
      }, {
        onConflict: 'url'
      });

    if (analysisError) {
      throw analysisError;
    }

    logger.info('Analysis completed successfully');
    return new Response(
      JSON.stringify(analysis),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    logger.error('Error in analysis:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.response ? await error.response.text() : undefined
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});