import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { extractContent } from "./content-analyzer.ts";
import { extractKeywords } from "./keyword-extractor.ts";
import { generateSEOSuggestions } from "./modules/suggestion-generator.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.3";
import { savePageData } from "./db.ts";

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

    if (!url || typeof url !== 'string') {
      throw new Error('Valid URL is required');
    }

    console.log('Analyzing URL:', url);

    // Extract content and analyze
    const { title, content } = await extractContent(url);
    console.log('Content extracted:', { title, contentLength: content.length });

    const keywords = await extractKeywords(content);
    console.log('Keywords extracted:', keywords);

    const suggestions = await generateSEOSuggestions(content, keywords.exact_match, url);
    console.log('Generated suggestions:', suggestions);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Saving data to database...');

    try {
      // First, get or create website record
      const domain = new URL(url).hostname;
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
        console.error('Error saving website:', websiteError);
        throw websiteError;
      }
      console.log('Website record saved:', website);

      // Save page record
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
        console.error('Error saving page:', pageError);
        throw pageError;
      }
      console.log('Page record saved:', page);

      // Save page analysis
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
        console.error('Error saving page analysis:', analysisError);
        throw analysisError;
      }
      console.log('Page analysis saved successfully');

    } catch (dbError) {
      console.error('Database operation failed:', dbError);
      throw new Error(`Failed to save data: ${dbError.message}`);
    }

    const analysisResult = {
      keywords,
      outboundSuggestions: suggestions
    };

    console.log('Analysis completed successfully:', analysisResult);
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