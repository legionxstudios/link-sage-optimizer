import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    console.log('Starting analysis for:', url);

    if (!url) {
      throw new Error('URL is required');
    }

    // Fetch and parse the source page content
    const response = await fetch(url);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    if (!doc) {
      throw new Error('Failed to parse webpage');
    }

    // Extract main content
    const mainContent = doc.querySelector('main, article, .content, .post-content, [role="main"]');
    const sourceContent = mainContent ? mainContent.textContent : doc.body.textContent;
    const sourceTitle = doc.querySelector('title')?.textContent || '';
    
    // Extract keywords from source content
    const sourceKeywords = extractKeywords(sourceContent);
    console.log('Extracted keywords:', sourceKeywords);

    // Get the domain from the URL
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    // Fetch website ID
    const { data: website } = await supabase
      .from('websites')
      .select('id')
      .eq('domain', domain)
      .single();

    if (!website) {
      console.log('Website not found in database');
      return new Response(
        JSON.stringify({
          keywords: { exact_match: [], broad_match: [], related_match: [] },
          outboundSuggestions: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch other pages from the same website
    const { data: pages, error: pagesError } = await supabase
      .from('pages')
      .select('id, url, title, content')
      .eq('website_id', website.id)
      .neq('url', url);

    if (pagesError) {
      console.error('Error fetching pages:', pagesError);
      throw pagesError;
    }

    // Generate suggestions based on content similarity
    const suggestions = [];
    
    if (pages) {
      for (const page of pages) {
        // Calculate content similarity
        const pageKeywords = extractKeywords(page.content || '');
        const similarityScore = calculateSimilarity(sourceKeywords, pageKeywords);
        
        // Find relevant context for the link
        const context = findLinkContext(sourceContent, page.title || '', pageKeywords);
        
        if (similarityScore > 0.2 && context) { // Adjust threshold as needed
          suggestions.push({
            suggestedAnchorText: page.title,
            context: context,
            matchType: 'internal_link',
            relevanceScore: similarityScore,
            targetUrl: page.url,
            targetTitle: page.title
          });
        }
      }
    }

    // Sort suggestions by relevance score
    suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);

    console.log('Generated suggestions:', suggestions);

    return new Response(
      JSON.stringify({
        keywords: {
          exact_match: sourceKeywords.slice(0, 5),
          broad_match: sourceKeywords.slice(5, 10),
          related_match: sourceKeywords.slice(10, 15)
        },
        outboundSuggestions: suggestions.slice(0, 5) // Return top 5 suggestions
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
  // Split content into words and clean them
  const words = content.toLowerCase()
    .split(/[\s.,!?;:()\[\]{}"']+/)
    .filter(word => word.length > 3)
    .filter(word => !commonWords.includes(word));

  // Count word frequencies
  const wordFreq: { [key: string]: number } = {};
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });

  // Extract phrases (2-3 words)
  const phrases = [];
  for (let i = 0; i < words.length - 1; i++) {
    const twoWordPhrase = `${words[i]} ${words[i + 1]}`;
    phrases.push(twoWordPhrase);
    
    if (i < words.length - 2) {
      const threeWordPhrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      phrases.push(threeWordPhrase);
    }
  }

  // Combine single words and phrases, sort by frequency
  return [...new Set([...Object.keys(wordFreq), ...phrases])];
}

function calculateSimilarity(keywords1: string[], keywords2: string[]): number {
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

function findLinkContext(sourceContent: string, targetTitle: string, targetKeywords: string[]): string | null {
  // Split source content into sentences
  const sentences = sourceContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // Look for sentences that contain the target title or keywords
  for (const sentence of sentences) {
    const sentenceLower = sentence.toLowerCase();
    if (
      sentenceLower.includes(targetTitle.toLowerCase()) ||
      targetKeywords.some(keyword => sentenceLower.includes(keyword.toLowerCase()))
    ) {
      return sentence.trim();
    }
  }
  
  return null;
}

const commonWords = [
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me'
];