import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SuggestionGenerator } from "./modules/suggestion-generator.ts";
import { extractContent } from "./content-analyzer.ts";
import { extractKeywords } from "./keyword-extractor.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Analyzing page content...');
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      throw new Error('Valid URL is required');
    }

    // Extract content with improved error handling
    const { title, content, links } = await extractContent(url);
    console.log('Content extracted, length:', content.length);
    console.log('Sample content:', content.substring(0, 200) + '...');

    // Process in parallel for efficiency
    const [keywords, suggestions] = await Promise.all([
      extractKeywords(content),
      new SuggestionGenerator().generateSuggestions(content, url)
    ]);

    const analysisResult = {
      keywords,
      outboundSuggestions: suggestions.slice(0, 10) // Limit suggestions
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