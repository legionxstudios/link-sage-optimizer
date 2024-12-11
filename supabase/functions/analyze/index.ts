import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    // Extract content from the webpage
    const response = await fetch(url);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    if (!doc) {
      throw new Error('Failed to parse webpage');
    }

    const title = doc.querySelector('title')?.textContent || '';
    const content = extractContent(doc);
    const mainKeywords = extractKeywords(content);
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Saving analysis results to database');

    const { data, error } = await supabase
      .from('page_analysis')
      .insert({
        url,
        title,
        content,
        main_keywords: mainKeywords,
        outbound_links_count: 0,
        inbound_links_count: 0,
        link_score: 0
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    console.log('Analysis saved successfully:', data);

    return new Response(
      JSON.stringify({
        pageContents: [{
          url,
          title,
          content,
          mainKeywords,
          internalLinksCount: 0,
          externalLinksCount: 0
        }],
        outboundSuggestions: [],
        inboundSuggestions: [],
        linkScore: 0
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

function extractContent(doc: Document): string {
  const contentSelectors = [
    'main',
    'article',
    '.content',
    '[role="main"]',
    '.post-content',
    '.entry-content'
  ];

  let content = '';
  
  // Try each selector
  for (const selector of contentSelectors) {
    const element = doc.querySelector(selector);
    if (element) {
      content = element.textContent || '';
      break;
    }
  }

  // Fallback to body if no content found
  if (!content) {
    content = doc.body?.textContent || '';
  }

  return content.trim();
}

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
    .slice(0, 10)
    .map(([word]) => word);
}