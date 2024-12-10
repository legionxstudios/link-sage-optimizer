import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { pipeline } from 'https://esm.sh/@huggingface/transformers'
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()
    console.log('Analyzing URL:', url)

    if (!url) {
      throw new Error('URL is required')
    }

    // Fetch and parse the webpage
    const response = await fetch(url);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    if (!doc) {
      throw new Error('Failed to parse webpage');
    }

    // Extract title and content
    const title = doc.querySelector('title')?.textContent || '';
    const content = Array.from(doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6'))
      .map(el => el.textContent)
      .join(' ')
      .trim();

    // Extract all internal links
    const baseUrl = new URL(url).origin;
    const links = Array.from(doc.querySelectorAll('a[href]'))
      .map(link => ({
        href: link.getAttribute('href'),
        text: link.textContent?.trim()
      }))
      .filter(link => link.href && link.href.startsWith('/') || link.href.startsWith(baseUrl));

    // Initialize the zero-shot classification pipeline
    const classifier = await pipeline('zero-shot-classification', 'facebook/bart-large-mnli');

    // Analyze content for main keywords
    const candidateKeywords = [
      "technology", "business", "health", "education", "entertainment",
      "sports", "science", "politics", "lifestyle", "travel"
    ];

    const keywordResults = await classifier(content, candidateKeywords, {
      multi_label: true
    });

    // Filter keywords with confidence > 0.3
    const mainKeywords = keywordResults.labels.filter((_, i) => 
      keywordResults.scores[i] > 0.3
    );

    // Generate link suggestions based on content analysis
    const suggestions = await Promise.all(
      links.map(async (link) => {
        // Analyze relevance between link text and surrounding content
        const relevanceScore = await classifier(
          link.text || '',
          [content.substring(0, 200)], // Use beginning of content as context
          { multi_label: false }
        ).then(result => result.scores[0]);

        return {
          sourceUrl: link.href?.startsWith('/') ? `${baseUrl}${link.href}` : link.href,
          targetUrl: url,
          suggestedAnchorText: link.text || '',
          relevanceScore,
          context: content.substring(0, 200) // Provide some context from the content
        };
      })
    );

    // Create a Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabase = createClient(supabaseUrl!, supabaseKey!)

    // Store analysis results in the database
    const { data, error } = await supabase
      .from('page_analysis')
      .insert({
        url,
        title,
        content,
        main_keywords: mainKeywords,
        suggestions
      })
      .select()
      .single()

    if (error) throw error

    return new Response(
      JSON.stringify({
        totalLinks: links.length,
        issues: suggestions.filter(s => s.relevanceScore < 0.5).length,
        status: 'complete',
        suggestions
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})