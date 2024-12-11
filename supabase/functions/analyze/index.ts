import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { extractContent } from "./content-analyzer.ts";
import { extractKeywords } from "./keyword-extractor.ts";
import { generateSEOSuggestions } from "./modules/suggestion-generator.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting page analysis...');
    const { url } = await req.json();
    console.log('Received URL:', url);

    if (!url || typeof url !== 'string') {
      console.error('Invalid URL provided');
      throw new Error('Valid URL is required');
    }

    // Extract content and analyze
    console.log('Extracting content from URL:', url);
    const { title, content } = await extractContent(url);
    console.log('Content extracted:', { 
      title, 
      contentLength: content.length,
      contentPreview: content.substring(0, 100) + '...' 
    });

    if (!content || content.length < 10) {
      console.error('Extracted content is too short or empty');
      throw new Error('Could not extract meaningful content from URL');
    }

    console.log('Extracting keywords...');
    const keywords = await extractKeywords(content);
    console.log('Keywords extracted:', keywords);

    if (!keywords.exact_match || keywords.exact_match.length === 0) {
      console.warn('No exact match keywords found');
    }

    console.log('Generating SEO suggestions...');
    const suggestions = await generateSEOSuggestions(content, keywords.exact_match, url);
    console.log('Generated suggestions:', suggestions);

    // Initialize Supabase client
    console.log('Initializing Supabase client...');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting database operations...');
    
    try {
      // First, get or create website record
      const domain = new URL(url).hostname;
      console.log('Processing domain:', domain);
      
      const { data: website, error: websiteError } = await supabase
        .from('websites')
        .upsert({
          domain,
          last_crawled_at: new Date().toISOString()
        }, {
          onConflict: 'domain'
        })
        .select()
        .single();

      if (websiteError) {
        console.error('Website upsert error:', websiteError);
        throw websiteError;
      }
      console.log('Website record saved:', website);

      // Save page record
      console.log('Saving page record...');
      const { data: page, error: pageError } = await supabase
        .from('pages')
        .upsert({
          website_id: website.id,
          url: url,
          title: title,
          content: content,
          last_crawled_at: new Date().toISOString()
        }, {
          onConflict: 'url'
        })
        .select()
        .single();

      if (pageError) {
        console.error('Page upsert error:', pageError);
        throw pageError;
      }
      console.log('Page record saved:', page);

      // Save page analysis
      console.log('Saving page analysis...');
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
        });

      if (analysisError) {
        console.error('Analysis upsert error:', analysisError);
        throw analysisError;
      }
      console.log('Page analysis saved successfully');

    } catch (dbError) {
      console.error('Database operation failed:', dbError);
      throw new Error(`Database operation failed: ${dbError.message}`);
    }

    const analysisResult = {
      keywords,
      outboundSuggestions: suggestions
    };

    console.log('Analysis completed successfully');
    return new Response(
      JSON.stringify(analysisResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analysis:', error);
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