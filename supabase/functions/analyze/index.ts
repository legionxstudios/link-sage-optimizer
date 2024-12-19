import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logger } from "./utils/logger.ts";
import { fetchAndExtractContent } from "./utils/content-extractor.ts";
import { analyzeWithOpenAI } from "./utils/openai.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    logger.info('Starting analysis for URL:', url);

    if (!url || typeof url !== 'string') {
      throw new Error('Valid URL is required');
    }

    // Check if OpenAI API key is configured
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      logger.error('OpenAI API key is not configured');
      throw new Error('OpenAI API key is not configured');
    }

    // Extract content
    const { title, content } = await fetchAndExtractContent(url);
    logger.info('Content extracted, length:', content.length);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get existing pages from database
    const { data: existingPages, error: pagesError } = await supabase
      .from('pages')
      .select('url, title, content')
      .neq('url', url);

    if (pagesError) {
      logger.error('Error fetching existing pages:', pagesError);
      throw pagesError;
    }

    // Analyze with OpenAI
    try {
      const analysis = await analyzeWithOpenAI(content);
      logger.info('OpenAI analysis complete');

      // Store analysis results
      const { error: analysisError } = await supabase
        .from('page_analysis')
        .upsert({
          url,
          title,
          content,
          seo_keywords: analysis.keywords,
          suggestions: analysis.outboundSuggestions
        });

      if (analysisError) {
        logger.error('Error storing analysis:', analysisError);
        throw analysisError;
      }

      return new Response(
        JSON.stringify(analysis),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (openAIError) {
      logger.error('OpenAI analysis failed:', openAIError);
      throw new Error(`OpenAI analysis failed: ${openAIError.message}`);
    }

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