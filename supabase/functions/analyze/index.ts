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
    const requestData = await req.json();
    logger.info('Received request data:', requestData);

    if (!requestData?.url) {
      logger.error('Missing URL in request');
      throw new Error('URL is required');
    }

    const url = requestData.url;
    logger.info('Processing URL:', url);

    // Extract content from the URL
    const { title, content } = await extractContent(url);
    if (!content) {
      throw new Error('Failed to extract content from URL');
    }
    
    logger.info('Content extracted successfully', { title, contentLength: content.length });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get website info and existing pages
    const domain = new URL(url).hostname;
    const { data: websiteData, error: websiteError } = await supabase
      .from('websites')
      .select('id')
      .eq('domain', domain)
      .single();

    if (websiteError) {
      throw websiteError;
    }

    const { data: existingPages, error: pagesError } = await supabase
      .from('pages')
      .select('url, title, content')
      .eq('website_id', websiteData.id)
      .neq('url', url);

    if (pagesError) {
      throw pagesError;
    }

    // Analyze content with OpenAI
    logger.info('Starting OpenAI analysis');
    const analysis = await analyzeWithOpenAI(content, existingPages || [], url);

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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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