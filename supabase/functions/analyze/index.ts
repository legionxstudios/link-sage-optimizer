import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
import { extractContent } from "./content-extractor.ts";
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);

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

    // Get the domain from the URL
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    // Fetch other pages from the same website
    const { data: pages, error: pagesError } = await supabase
      .from('pages')
      .select('id, url, title, content')
      .neq('url', url)
      .eq('website_id', (
        await supabase
          .from('websites')
          .select('id')
          .eq('domain', domain)
          .single()
      ).data?.id);

    if (pagesError) {
      console.error('Error fetching pages:', pagesError);
      throw pagesError;
    }

    // Generate internal link suggestions
    const suggestions = generateInternalLinkSuggestions(
      extractedContent.content,
      keywords,
      pages || []
    );

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
        status: 500,
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

interface Page {
  id: string;
  url: string;
  title: string;
  content: string;
}

function generateInternalLinkSuggestions(
  sourceContent: string,
  keywords: string[],
  pages: Page[]
): Array<{
  suggestedAnchorText: string;
  context: string;
  matchType: string;
  relevanceScore: number;
  targetUrl?: string;
  targetTitle?: string;
}> {
  const suggestions = [];

  // Split source content into paragraphs
  const paragraphs = sourceContent.split('\n').filter(p => p.trim().length > 0);

  // For each page, check content similarity and keyword matches
  for (const page of pages) {
    // Calculate content similarity score
    const similarityScore = calculateSimilarity(sourceContent, page.content);

    // Find matching keywords in the target page
    const matchingKeywords = keywords.filter(keyword => 
      page.content.toLowerCase().includes(keyword.toLowerCase()) ||
      page.title.toLowerCase().includes(keyword.toLowerCase())
    );

    if (matchingKeywords.length > 0) {
      // For each matching keyword, find relevant context in source content
      for (const keyword of matchingKeywords) {
        const relevantParagraph = paragraphs.find(p => 
          p.toLowerCase().includes(keyword.toLowerCase())
        );

        if (relevantParagraph) {
          // Calculate final relevance score based on content similarity and keyword presence
          const relevanceScore = (
            similarityScore * 0.6 + // Content similarity weight
            (matchingKeywords.length / keywords.length) * 0.4 // Keyword match weight
          );

          if (relevanceScore > 0.3) { // Only suggest if relevance is above threshold
            suggestions.push({
              suggestedAnchorText: keyword,
              context: relevantParagraph.substring(0, 200) + '...',
              matchType: 'internal_link',
              relevanceScore,
              targetUrl: page.url,
              targetTitle: page.title
            });
          }
        }
      }
    }
  }

  // Sort by relevance score and return top suggestions
  return suggestions
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 5);
}

function calculateSimilarity(text1: string, text2: string): number {
  // Convert texts to word sets
  const words1 = new Set(text1.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  const words2 = new Set(text2.toLowerCase().split(/\W+/).filter(w => w.length > 3));

  // Calculate Jaccard similarity
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}