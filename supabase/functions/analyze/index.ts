import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logger } from "./utils/logger.ts";
import { fetchAndExtractContent } from "./utils/content-extractor.ts";
import { analyzeWithOpenAI } from "./utils/openai.ts";
import { generateSEOSuggestions } from "./modules/suggestion-generator.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Extract content
    const { title, content } = await fetchAndExtractContent(url);
    logger.info('Content extracted, length:', content.length);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get existing pages from database
    const { data: existingPages, error: pagesError } = await supabase
      .from('pages')
      .select('url, title, content')
      .neq('url', url);

    if (pagesError) {
      logger.error('Error fetching existing pages:', pagesError);
      throw pagesError;
    }

    logger.info(`Found ${existingPages?.length || 0} existing pages to consider for linking`);

    // Analyze with OpenAI
    const analysis = await analyzeWithOpenAI(content);
    logger.info('OpenAI analysis complete');

    // Generate link suggestions
    const suggestions = await generateSEOSuggestions(
      analysis.keywords.exact_match,
      content,
      existingPages || []
    );

    logger.info(`Generated ${suggestions.length} link suggestions`);

    const finalAnalysis = {
      keywords: analysis.keywords,
      outboundSuggestions: suggestions
    };

    return new Response(
      JSON.stringify(finalAnalysis),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logger.error('Error in analysis:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});