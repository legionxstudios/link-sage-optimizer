import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { extractContent } from "./content-extractor.ts";
import { extractKeywords } from "./keyword-extractor.ts";
import { generateSuggestions } from "./suggestion-generator.ts";

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
    // Get the request body as a JSON object directly
    const requestData = await req.json();
    console.log('Received request data:', requestData);

    const { url } = requestData;
    console.log('Starting analysis for:', url);

    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Valid URL is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Extract content with timeout
    const timeoutMs = 30000; // 30 second timeout
    const contentPromise = extractContent(url);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Content extraction timed out')), timeoutMs)
    );

    console.log('Extracting content...');
    const { title, content, links } = await Promise.race([contentPromise, timeoutPromise]);
    console.log('Content extracted, length:', content.length);

    // Process in parallel for efficiency
    console.log('Starting keyword extraction and suggestion generation...');
    const [keywords, suggestions] = await Promise.all([
      extractKeywords(content),
      generateSuggestions(content, links || [], url, title)
    ]);

    const analysisResult = {
      title,
      content: content.slice(0, 5000), // Limit content length in response
      keywords,
      outboundSuggestions: suggestions.slice(0, 10), // Limit suggestions
      themes: [], // Will be populated by theme analysis
    };

    console.log('Analysis completed successfully');
    return new Response(
      JSON.stringify(analysisResult),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json'
        } 
      }
    );

  } catch (error) {
    console.error('Error in analyze function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.toString(),
        stack: error.stack
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json'
        }
      }
    );
  }
});