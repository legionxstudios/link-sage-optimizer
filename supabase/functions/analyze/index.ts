import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractContent } from "./content-analyzer.ts";
import { analyzeKeywords } from "./keyword-analyzer.ts";
import { generateSEOSuggestions } from "./modules/suggestion-generator.ts";

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
    console.log('Analyzing URL:', url);

    if (!url || typeof url !== 'string') {
      throw new Error('Valid URL is required');
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Extract content from the URL
    console.log('Extracting content...');
    const { content, title } = await extractContent(url);
    console.log('Content extracted, length:', content.length);

    // Analyze keywords
    console.log('Analyzing keywords...');
    const keywords = await analyzeKeywords(content);
    console.log('Keywords extracted:', keywords);

    // Generate suggestions
    console.log('Generating suggestions...');
    const suggestions = await generateSEOSuggestions(content, keywords, url, []);
    console.log('Generated suggestions:', suggestions);

    // Save analysis to database using upsert
    console.log('Saving/updating analysis in database...');
    const { error: analysisError } = await supabase
      .from('page_analysis')
      .upsert({
        url,
        title,
        content,
        main_keywords: keywords,
        seo_keywords: {
          exact_match: keywords.slice(0, 5),
          broad_match: keywords.slice(5, 10),
          related_match: keywords.slice(10, 15)
        },
        suggestions,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'url',
        ignoreDuplicates: false
      });

    if (analysisError) {
      console.error('Error saving analysis:', analysisError);
      throw analysisError;
    }

    console.log('Analysis saved successfully');

    return new Response(
      JSON.stringify({
        keywords: {
          exact_match: keywords.slice(0, 5),
          broad_match: keywords.slice(5, 10),
          related_match: keywords.slice(10, 15)
        },
        suggestions
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
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