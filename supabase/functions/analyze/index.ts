import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

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
    console.log('Starting analysis for URL:', url);

    if (!url) {
      throw new Error('URL is required');
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch page content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LovableCrawler/1.0)'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.status}`);
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (!doc) {
      throw new Error('Failed to parse webpage');
    }

    // Extract content
    const title = doc.querySelector('title')?.textContent || '';
    const content = extractContent(doc);
    console.log('Extracted content length:', content.length);

    // Get website domain
    const domain = new URL(url).hostname;

    // Get website ID
    const { data: website } = await supabase
      .from('websites')
      .select('id')
      .eq('domain', domain)
      .single();

    if (!website) {
      throw new Error('Website not found');
    }

    // Get existing pages from the same website
    const { data: existingPages } = await supabase
      .from('pages')
      .select('url, title, content')
      .eq('website_id', website.id)
      .neq('url', url);

    // Analyze with OpenAI
    try {
      const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openAIApiKey) {
        throw new Error('OpenAI API key not configured');
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are an SEO expert. Extract keywords and suggest relevant internal linking opportunities from the provided list of pages. Return a JSON object with:
              1. keywords categorized into arrays (exact_match, broad_match, related_match)
              2. outboundSuggestions array with specific anchor text and target URLs from the provided pages list.
              Each suggestion should include suggestedAnchorText, targetUrl, context, and relevanceScore.`
            },
            {
              role: 'user',
              content: `Analyze this content and suggest links to these existing pages:\n\nContent: ${content.substring(0, 3000)}\n\nAvailable pages: ${JSON.stringify(existingPages?.slice(0, 5))}`
            }
          ],
          temperature: 0.3,
          response_format: { type: "json_object" }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('OpenAI response:', data);

      if (!data.choices?.[0]?.message?.content) {
        throw new Error('Invalid OpenAI response format');
      }

      const analysis = JSON.parse(data.choices[0].message.content);

      // Store analysis results
      const { error: analysisError } = await supabase
        .from('page_analysis')
        .upsert({
          url,
          title,
          content,
          main_keywords: analysis.keywords?.exact_match || [],
          seo_keywords: analysis.keywords || {},
          suggestions: analysis.outboundSuggestions || [],
          created_at: new Date().toISOString()
        }, {
          onConflict: 'url',
          update: {
            title,
            content,
            main_keywords: analysis.keywords?.exact_match || [],
            seo_keywords: analysis.keywords || {},
            suggestions: analysis.outboundSuggestions || []
          }
        });

      if (analysisError) {
        throw analysisError;
      }

      return new Response(
        JSON.stringify(analysis),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      console.error('OpenAI analysis failed:', error);
      throw new Error(`OpenAI analysis failed: ${error.message}`);
    }

  } catch (error) {
    console.error('Error in analysis:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.response ? await error.response.text() : undefined
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function extractContent(doc: Document): string {
  // Remove non-content elements
  ['script', 'style', 'nav', 'footer', 'header', 'aside'].forEach(tag => {
    doc.querySelectorAll(tag).forEach(el => el.remove());
  });

  // Find main content container
  const selectors = [
    'main',
    'article',
    '[role="main"]',
    '.content',
    '.post-content',
    '.entry-content',
    '#content'
  ];

  let mainElement = null;
  for (const selector of selectors) {
    mainElement = doc.querySelector(selector);
    if (mainElement) break;
  }

  // Fallback to body if no main content found
  if (!mainElement) {
    mainElement = doc.body;
  }

  if (!mainElement) return '';

  // Extract text content
  return mainElement.textContent?.trim() || '';
}