import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logger } from "./utils/logger.ts";
import { fetchAndExtractContent } from "./utils/content-extractor.ts";
import { analyzeWithOpenAI } from "./utils/openai.ts";
import { saveAnalysisResults } from "./utils/db.ts";

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

    // Extract content
    const { title, content } = await fetchAndExtractContent(url);
    logger.info('Content extracted, length:', content.length);

    // Analyze keywords
    logger.info('Analyzing keywords...');
    const keywords = await analyzeWithOpenAI(content);
    logger.info('Keywords extracted:', keywords);

    // Generate suggestions (simplified for now)
    const suggestions = keywords.exact_match.map(keyword => ({
      suggestedAnchorText: keyword,
      context: content.substring(0, 200),
      matchType: 'keyword_based',
      relevanceScore: 0.8
    }));
    logger.info('Generated suggestions:', suggestions);

    // Save results
    await saveAnalysisResults(url, title, content, keywords, suggestions);

    logger.info('Analysis completed successfully');
    return new Response(
      JSON.stringify({
        keywords,
        outboundSuggestions: suggestions
      }),
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
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});