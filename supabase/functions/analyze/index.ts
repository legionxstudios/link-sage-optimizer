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
    // First check if the content-type is correct
    const contentType = req.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      console.error('Invalid content type:', contentType);
      return new Response(
        JSON.stringify({ error: 'Content-Type must be application/json' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get the raw body first
    const rawBody = await req.text();
    console.log('Raw request body:', rawBody);

    // Try to parse the JSON
    let requestData;
    try {
      requestData = JSON.parse(rawBody);
    } catch (error) {
      console.error('Failed to parse JSON:', error, 'Raw body:', rawBody);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON in request body',
          details: error.message,
          receivedBody: rawBody
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Parsed request data:', requestData);

    const { url } = requestData;
    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Valid URL is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Starting analysis for:', url);

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