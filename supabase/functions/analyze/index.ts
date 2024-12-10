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

    // Store analysis results
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('page_analysis')
      .insert({
        url,
        title,
        content: content.substring(0, 500),
        main_keywords: mainKeywords,
        suggestions
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({
        pageContents: [{
          url,
          title,
          content: content.substring(0, 500),
          mainKeywords
        }],
        suggestions
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