import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logger } from "./utils/logger.ts";
import { fetchAndExtractContent } from "./utils/content-extractor.ts";
import { saveAnalysisResults } from "./utils/db.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

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

    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured');
    }

    // Extract content
    const { title, content } = await fetchAndExtractContent(url);
    logger.info('Content extracted, length:', content.length);

    // Analyze with OpenAI
    logger.info('Analyzing content with OpenAI...');
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an SEO expert. Analyze the content and return a JSON object with:
              1. keywords: categorized arrays of keywords (exact_match, broad_match, related_match)
              2. outboundSuggestions: array of link suggestions with suggestedAnchorText, context, matchType, relevanceScore, and targetUrl
              
              Format the response as a clean JSON object without any markdown formatting.`
          },
          {
            role: 'user',
            content: `Analyze this content and return a JSON object with keywords and linking suggestions:\n\n${content.substring(0, 2000)}`
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      logger.error('OpenAI API error:', openAIResponse.status, errorText);
      throw new Error(`OpenAI API error: ${openAIResponse.status} ${openAIResponse.statusText}`);
    }

    const openAIData = await openAIResponse.json();
    logger.debug('OpenAI response:', openAIData);

    if (!openAIData.choices?.[0]?.message?.content) {
      logger.error('Invalid OpenAI response format:', openAIData);
      throw new Error('Invalid OpenAI response format');
    }

    // Parse the response, ensuring it's clean JSON
    const analysis = JSON.parse(openAIData.choices[0].message.content);
    logger.info('Successfully parsed OpenAI response');

    // Save results
    await saveAnalysisResults(url, title, content, analysis.keywords, analysis.outboundSuggestions);
    logger.info('Analysis results saved to database');

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
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});