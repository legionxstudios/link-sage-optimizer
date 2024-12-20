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
    // Parse and validate request body
    const requestData = await req.json();
    logger.info('Received request data:', requestData);

    if (!requestData?.url) {
      logger.error('Missing URL in request');
      throw new Error('URL is required');
    }

    const url = requestData.url;
    logger.info('Processing URL:', url);

    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      logger.error(`Invalid URL format: ${url}`);
      throw new Error(`Invalid URL format: ${url}`);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      logger.error('Missing Supabase configuration');
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract content from the URL
    const { title, content } = await extractContent(url);
    logger.info('Content extracted successfully', { title });

    // Get website info
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

    if (!websiteData?.id) {
      logger.error('No website found for domain:', domain);
      throw new Error(`No website found for domain: ${domain}`);
    }

    // Get existing pages
    logger.info('Fetching existing pages for website:', websiteData.id);
    const { data: existingPages, error: pagesError } = await supabase
      .from('pages')
      .select('url, title, content')
      .eq('website_id', websiteData.id)
      .neq('url', url);

    if (pagesError) {
      logger.error('Error fetching existing pages:', pagesError);
      throw new Error('Failed to fetch existing pages');
    }

    // Log detailed information about fetched pages
    logger.info(`Found ${existingPages?.length || 0} existing pages to analyze`);
    logger.info('URL patterns found:', existingPages?.map(p => new URL(p.url).pathname));

    // Analyze content with OpenAI
    logger.info('Starting OpenAI analysis');
    const analysis = await analyzeWithOpenAI(content, existingPages || [], url);
    logger.info('Analysis completed:', {
      keywordCount: Object.keys(analysis.keywords || {}).length,
      suggestionCount: analysis.outboundSuggestions?.length || 0
    });

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
      logger.error('Error storing analysis:', analysisError);
      throw analysisError;
    }

    logger.info('Analysis results stored successfully');
    logger.info('Final analysis output:', analysis);

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