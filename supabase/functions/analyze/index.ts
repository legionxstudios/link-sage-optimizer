import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

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

    // Use OpenAI to analyze content and generate keywords
    const keywordResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an SEO expert. Extract the main topics/keywords from the given content. Return only an array of keywords, nothing else.'
          },
          {
            role: 'user',
            content: content.substring(0, 1000) // First 1000 chars for context
          }
        ],
      }),
    });

    const keywordData = await keywordResponse.json();
    const mainKeywords = JSON.parse(keywordData.choices[0].message.content);

    // Analyze links and generate suggestions
    const suggestions = await Promise.all(
      links.map(async (link) => {
        // Use OpenAI to analyze relevance
        const relevanceResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are an SEO expert. Rate the relevance between the link text and the surrounding content on a scale of 0 to 1. Return only the number, nothing else.'
              },
              {
                role: 'user',
                content: `Link text: "${link.text}"\nContent context: "${content.substring(0, 200)}"`
              }
            ],
          }),
        });

        const relevanceData = await relevanceResponse.json();
        const relevanceScore = parseFloat(relevanceData.choices[0].message.content);

        return {
          sourceUrl: link.href?.startsWith('/') ? `${baseUrl}${link.href}` : link.href,
          targetUrl: url,
          suggestedAnchorText: link.text || '',
          relevanceScore,
          context: content.substring(0, 200)
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