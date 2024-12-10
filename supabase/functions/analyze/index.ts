import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { extractContent } from './content-extractor.ts'
import { analyzeKeywords } from './keyword-analyzer.ts'
import { generateLinkSuggestions } from './link-suggester.ts'

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
    console.log('Analyzing URL:', url);

    if (!url) {
      throw new Error('URL is required');
    }

    // Extract content from the webpage
    const { title, content, paragraphs, existingLinks } = await extractContent(url);
    console.log('Extracted content length:', content.length);
    
    // Analyze keywords in the content
    const mainKeywords = await analyzeKeywords(content);
    console.log('Main keywords:', mainKeywords);
    
    // Generate link suggestions
    const suggestions = await generateLinkSuggestions(
      paragraphs,
      mainKeywords,
      url,
      existingLinks
    );
    
    console.log('Generated suggestions:', suggestions.length);

    // Store analysis results - now storing full content
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('page_analysis')
      .insert({
        url,
        title,
        content: content, // Store the full content without truncation
        main_keywords: mainKeywords,
        suggestions,
        outbound_links_count: existingLinks.length,
        inbound_links_count: 0, // This will be updated after crawling
        link_score: 0 // This will be calculated after crawling
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    console.log('Stored content length:', data.content.length);

    return new Response(
      JSON.stringify({
        pageContents: [{
          url,
          title,
          content: content, // Return full content
          mainKeywords,
          internalLinksCount: existingLinks.length,
          externalLinksCount: 0
        }],
        outboundSuggestions: suggestions.outbound || [],
        inboundSuggestions: suggestions.inbound || [],
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
})