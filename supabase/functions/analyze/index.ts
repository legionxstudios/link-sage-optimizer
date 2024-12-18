import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logger } from "./utils/logger.ts";
import { fetchAndExtractContent } from "./utils/content-extractor.ts";
import { saveAnalysisResults } from "./utils/db.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);

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

    // First, get existing pages from our database
    const { data: existingPages, error: pagesError } = await supabase
      .from('pages')
      .select('url, title, content')
      .neq('url', url); // Exclude current page

    if (pagesError) {
      logger.error('Error fetching existing pages:', pagesError);
      throw pagesError;
    }

    logger.info(`Found ${existingPages?.length || 0} existing pages to consider for linking`);

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
            content: `You are an SEO expert. Analyze the content and:
              1. Extract EXISTING phrases from the content that could be good anchor text for links
              2. Identify key topics and themes in the content
              
              Return a JSON object with:
              1. keywords: categorized arrays of keywords found in the content (exact_match, broad_match, related_match)
              2. key_phrases: array of 2-3 word phrases that actually appear in the content and could be good anchor text
              
              Format the response as a clean JSON object without any markdown formatting.`
          },
          {
            role: 'user',
            content: `Analyze this content and extract existing phrases that could be good anchor text:\n\n${content.substring(0, 2000)}`
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

    // Parse the response
    const analysis = JSON.parse(openAIData.choices[0].message.content);
    logger.info('Successfully parsed OpenAI response');

    // Generate link suggestions based on extracted phrases
    const outboundSuggestions = [];
    
    // For each key phrase, find relevant pages
    for (const phrase of analysis.key_phrases || []) {
      // Find pages containing this phrase in title or content
      const relevantPages = existingPages?.filter(page => 
        page.title?.toLowerCase().includes(phrase.toLowerCase()) ||
        page.content?.toLowerCase().includes(phrase.toLowerCase())
      ) || [];

      logger.info(`Found ${relevantPages.length} relevant pages for phrase: ${phrase}`);

      // Find the context where this phrase appears in our content
      const phraseContext = findPhraseContext(content, phrase);

      // Create suggestions for each relevant page
      for (const page of relevantPages) {
        outboundSuggestions.push({
          suggestedAnchorText: phrase,
          context: phraseContext,
          matchType: "keyword_based",
          relevanceScore: calculateRelevanceScore(phrase, page),
          targetUrl: page.url,
          targetTitle: page.title
        });
      }
    }

    // Sort by relevance score and limit to top suggestions
    outboundSuggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const finalSuggestions = outboundSuggestions.slice(0, 10);

    const finalAnalysis = {
      keywords: analysis.keywords,
      outboundSuggestions: finalSuggestions
    };

    // Save results
    await saveAnalysisResults(url, title, content, analysis.keywords, finalSuggestions);
    logger.info('Analysis results saved to database');

    return new Response(
      JSON.stringify(finalAnalysis),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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

// Helper function to find context for a phrase
function findPhraseContext(content: string, phrase: string, contextLength: number = 100): string {
  try {
    const phraseIndex = content.toLowerCase().indexOf(phrase.toLowerCase());
    if (phraseIndex === -1) return "";
    
    const start = Math.max(0, phraseIndex - contextLength);
    const end = Math.min(content.length, phraseIndex + phrase.length + contextLength);
    
    let context = content.slice(start, end).trim();
    // Highlight the phrase
    const regex = new RegExp(`(${phrase})`, 'gi');
    context = context.replace(regex, '[$1]');
    
    return context;
  } catch (error) {
    logger.error('Error finding context:', error);
    return "";
  }
}

// Helper function to calculate relevance score
function calculateRelevanceScore(phrase: string, page: { title?: string; content?: string }): number {
  try {
    let score = 0;
    const phraseLower = phrase.toLowerCase();
    
    // Check title match
    if (page.title?.toLowerCase().includes(phraseLower)) {
      score += 0.5;
    }
    
    // Check content match and frequency
    if (page.content) {
      const contentLower = page.content.toLowerCase();
      const frequency = (contentLower.match(new RegExp(phraseLower, 'g')) || []).length;
      score += Math.min(0.5, frequency * 0.1); // Cap content score at 0.5
    }
    
    return Math.min(1.0, score); // Ensure final score doesn't exceed 1.0
  } catch (error) {
    logger.error('Error calculating relevance:', error);
    return 0;
  }
}