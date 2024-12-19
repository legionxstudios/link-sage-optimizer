import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractContent } from "./utils/content-extractor.ts";
import { analyzeWithOpenAI } from "./utils/openai.ts";
import { logger } from "./utils/logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, crawlCompleted } = await req.json();
    logger.info('Starting analysis for:', url);

    if (!url) {
      throw new Error('URL is required');
    }

    // Wait for crawling to be completed
    if (!crawlCompleted) {
      return new Response(
        JSON.stringify({ 
          error: 'Crawling not completed',
          details: 'Please wait for crawling to complete before analysis'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract content from the URL
    const { title, content } = await extractContent(url);
    logger.info('Content extracted successfully', { title });

    // Get existing pages from the same website
    const domain = new URL(url).hostname;
    logger.info('Looking up website for domain:', domain);

    const { data: websiteData, error: websiteError } = await supabase
      .from('websites')
      .select('id')
      .eq('domain', domain)
      .single();

    if (websiteError) {
      logger.error('Error fetching website:', websiteError);
      throw new Error(`Database error: ${websiteError.message}`);
    }

    const { data: existingPages, error: pagesError } = await supabase
      .from('pages')
      .select('url, title, content')
      .eq('website_id', websiteData.id)
      .neq('url', url);

    if (pagesError) {
      logger.error('Error fetching existing pages:', pagesError);
      throw new Error('Failed to fetch existing pages');
    }

    // Analyze with OpenAI
    const analysis = await analyzeWithOpenAI(content, existingPages || []);
    logger.info('Analysis completed successfully');

    // Store analysis results
    const { error: analysisError } = await supabase
      .from('page_analysis')
      .upsert({
        url,
        title,
        content,
        detected_themes: analysis.themes,
        main_keywords: analysis.keywords?.exact_match || [],
        seo_keywords: analysis.keywords || {},
        suggestions: analysis.outboundSuggestions || [],
        created_at: new Date().toISOString()
      }, {
        onConflict: 'url'
      });

    if (analysisError) {
      logger.error('Error storing analysis:', analysisError);
      throw analysisError;
    }

    logger.info('Analysis results stored successfully');

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