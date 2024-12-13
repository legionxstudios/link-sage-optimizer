import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractContent } from "./content-extractor.ts";
import { analyzeKeywords } from "./keyword-analyzer.ts";
import { generateSEOSuggestions } from "./modules/suggestion-generator.ts";
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
    const { url } = await req.json();
    logger.info('Starting analysis for URL:', url);

    if (!url || typeof url !== 'string') {
      throw new Error('Valid URL is required');
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Extract content from the URL
    logger.info('Extracting content...');
    const { content, title } = await extractContent(url);
    logger.info('Content extracted, length:', content.length);
    logger.debug('Page title:', title);

    // Analyze keywords
    logger.info('Analyzing keywords...');
    const keywords = await analyzeKeywords(content);
    logger.info('Keywords extracted:', keywords);

    // Generate suggestions
    logger.info('Generating suggestions...');
    const suggestions = await generateSEOSuggestions(content, [...keywords.exact_match, ...keywords.broad_match], url, []);
    logger.info('Generated suggestions:', suggestions);

    // Save/update analysis in database
    logger.info('Saving/updating analysis in database...');
    const { error: analysisError } = await supabase
      .from('page_analysis')
      .upsert({
        url,
        title,
        content,
        main_keywords: keywords.exact_match,
        seo_keywords: keywords,
        suggestions,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'url',
        ignoreDuplicates: false
      });

    if (analysisError) {
      logger.error('Error saving analysis:', analysisError);
      throw analysisError;
    }

    logger.info('Analysis completed successfully');

    return new Response(
      JSON.stringify({
        keywords,
        outboundSuggestions: suggestions
      }),
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
        details: error
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});