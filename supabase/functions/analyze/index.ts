import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { extractContent } from "./content-extractor.ts";
import { extractKeywords } from "./keyword-extractor.ts";
import { generateSuggestions } from "./suggestion-generator.ts";
import { savePageAnalysis } from "./db.ts";

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
    console.log('Starting analysis for:', url);

    if (!url || typeof url !== 'string') {
      throw new Error('Valid URL is required');
    }

    // Extract content with timeout
    const timeoutMs = 15000; // 15 second timeout
    const contentPromise = extractContent(url);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Content extraction timed out')), timeoutMs)
    );

    const { title, content, links } = await Promise.race([contentPromise, timeoutPromise]);
    console.log('Content extracted, length:', content.length);

    // Process in parallel for efficiency
    const [keywords, suggestions] = await Promise.all([
      extractKeywords(content),
      generateSuggestions(content, links, url, title) // Pass title as well
    ]);

    const analysisResult = {
      keywords,
      outboundSuggestions: suggestions.slice(0, 10) // Limit suggestions
    };

    console.log('Analysis completed successfully');
    return new Response(
      JSON.stringify(analysisResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});