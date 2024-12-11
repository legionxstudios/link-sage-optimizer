import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts"
import { extractContent } from "./content-extractor.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    console.log('Starting analysis for:', url);

    if (!url) {
      throw new Error('URL is required');
    }

    // Extract content from the webpage
    const extractedContent = await extractContent(url);
    console.log('Content extracted successfully');

    // Extract keywords using basic NLP
    const keywords = extractKeywords(extractedContent.content);
    console.log('Keywords extracted:', keywords);

    // Generate link suggestions based on keywords
    const suggestions = generateLinkSuggestions(extractedContent.content, keywords);
    console.log('Generated suggestions:', suggestions);

    return new Response(
      JSON.stringify({
        keywords: {
          exact_match: keywords.slice(0, 5),
          broad_match: keywords.slice(5, 10),
          related_match: keywords.slice(10, 15)
        },
        outboundSuggestions: suggestions
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});

function extractKeywords(content: string): string[] {
  const words = content.toLowerCase()
    .split(/\W+/)
    .filter(word => word.length > 3)
    .reduce((acc: { [key: string]: number }, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {});

  return Object.entries(words)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([word]) => word);
}

function generateLinkSuggestions(content: string, keywords: string[]): Array<{
  suggestedAnchorText: string;
  context: string;
  matchType: string;
  relevanceScore: number;
}> {
  const suggestions = [];
  const paragraphs = content.split('\n').filter(p => p.trim().length > 0);

  for (const keyword of keywords.slice(0, 5)) {
    const relevantParagraph = paragraphs.find(p => 
      p.toLowerCase().includes(keyword.toLowerCase())
    );

    if (relevantParagraph) {
      suggestions.push({
        suggestedAnchorText: keyword,
        context: relevantParagraph.substring(0, 200) + '...',
        matchType: 'keyword',
        relevanceScore: 0.8
      });
    }
  }

  return suggestions;
}