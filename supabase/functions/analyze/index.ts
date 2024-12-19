import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logger } from "./utils/logger.ts";
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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get website domain
    const domain = new URL(url).hostname;

    // Get website ID
    const { data: website, error: websiteError } = await supabase
      .from('websites')
      .select('id')
      .eq('domain', domain)
      .single();

    if (websiteError) {
      logger.error('Error fetching website:', websiteError);
      throw websiteError;
    }

    // Get existing pages from the same website
    const { data: existingPages, error: pagesError } = await supabase
      .from('pages')
      .select('url, title, content')
      .eq('website_id', website.id)
      .neq('url', url);

    if (pagesError) {
      logger.error('Error fetching existing pages:', pagesError);
      throw pagesError;
    }

    // Fetch current page content
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.status}`);
    }
    const html = await response.text();
    
    // Extract title and content (simplified for example)
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : '';
    const content = html.replace(/<[^>]*>/g, ' ').trim();

    // Analyze with OpenAI
    try {
      const analysis = await analyzeWithOpenAI(content, existingPages);
      logger.info('OpenAI analysis complete');

      // Store analysis results using upsert
      const { error: analysisError } = await supabase
        .from('page_analysis')
        .upsert({
          url,
          title,
          content,
          seo_keywords: analysis.keywords,
          suggestions: analysis.outboundSuggestions,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'url',
          update: {
            title,
            content,
            seo_keywords: analysis.keywords,
            suggestions: analysis.outboundSuggestions
          }
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