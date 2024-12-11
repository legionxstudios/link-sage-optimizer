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
    console.log('Analyzing page content...');
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      throw new Error('Valid URL is required');
    }

    // Extract content and analyze
    const { title, content } = await extractContent(url);
    console.log('Content extracted, length:', content.length);

    const keywords = await extractKeywords(content);
    console.log('Keywords extracted:', keywords);

    const suggestions = await generateSEOSuggestions(content, keywords.exact_match, url);
    console.log('Generated SEO suggestions:', suggestions);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Save all data to database
    await savePageData(supabase, {
      url,
      title,
      content,
      keywords,
      suggestions
    });

    const analysisResult = {
      keywords,
      outboundSuggestions: suggestions
    };

    console.log('Analysis completed:', analysisResult);
    return new Response(
      JSON.stringify(analysisResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
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