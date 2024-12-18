import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
import { logger } from "./utils/logger.ts";

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

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch and extract content
    logger.info('Fetching content from URL:', url);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkAnalyzerBot/1.0)',
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    if (!doc) {
      throw new Error('Failed to parse webpage');
    }

    // Extract main content
    const title = doc.querySelector('title')?.textContent || '';
    const mainContent = extractMainContent(doc);
    logger.info('Content extracted, length:', mainContent.length);

    // Analyze keywords using OpenAI
    logger.info('Analyzing keywords with OpenAI...');
    const keywords = await analyzeKeywords(mainContent);
    logger.info('Keywords extracted:', keywords);

    // Generate suggestions
    logger.info('Generating suggestions...');
    const suggestions = await generateSuggestions(mainContent, keywords);
    logger.info('Generated suggestions:', suggestions);

    // Save analysis results
    const { error: analysisError } = await supabase
      .from('page_analysis')
      .upsert({
        url,
        title,
        content: mainContent,
        main_keywords: keywords.exact_match,
        seo_keywords: keywords,
        suggestions,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'url'
      });

    if (analysisError) {
      logger.error('Error saving analysis:', analysisError);
      throw analysisError;
    }

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

function extractMainContent(doc: Document): string {
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

  // Extract text content
  const textContent = mainElement?.textContent || '';
  return textContent.replace(/\s+/g, ' ').trim();
}

async function analyzeKeywords(content: string) {
  try {
    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an SEO expert. Extract keywords from the content and categorize them into exact_match (primary keywords), broad_match (related terms), and related_match (broader topics). Return ONLY a JSON object with these three arrays.'
          },
          {
            role: 'user',
            content: `Analyze this content and return a JSON object with three arrays of keywords. Content: ${content.substring(0, 2000)}`
          }
        ],
        temperature: 0.3
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    return {
      exact_match: result.exact_match || [],
      broad_match: result.broad_match || [],
      related_match: result.related_match || []
    };
  } catch (error) {
    logger.error('Error analyzing keywords:', error);
    return {
      exact_match: [],
      broad_match: [],
      related_match: []
    };
  }
}

async function generateSuggestions(content: string, keywords: any) {
  try {
    // Generate link suggestions based on keywords
    const suggestions = keywords.exact_match.map((keyword: string) => ({
      suggestedAnchorText: keyword,
      context: findKeywordContext(content, keyword),
      matchType: 'keyword_based',
      relevanceScore: 0.8
    }));

    return suggestions;
  } catch (error) {
    logger.error('Error generating suggestions:', error);
    return [];
  }
}

function findKeywordContext(content: string, keyword: string): string {
  const keywordIndex = content.toLowerCase().indexOf(keyword.toLowerCase());
  if (keywordIndex === -1) return '';

  const start = Math.max(0, keywordIndex - 100);
  const end = Math.min(content.length, keywordIndex + keyword.length + 100);
  return content.slice(start, end).trim();
}