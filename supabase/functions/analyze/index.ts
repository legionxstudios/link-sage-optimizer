import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { extractContent } from "./content-analyzer.ts";
import { extractKeywords } from "./keyword-extractor.ts";
import { generateSEOSuggestions } from "./modules/suggestion-generator.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Analyzing page content...');
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      throw new Error('Valid URL is required');
    }

    const { title, content } = await extractContent(url);
    console.log('Content extracted, length:', content.length);

    const keywords = await extractKeywords(content);
    console.log('Keywords extracted:', keywords);

    // Generate SEO-focused link suggestions using actual content and URLs
    const suggestions = await generateSEOSuggestions(content, keywords.exact_match, url);
    console.log('Generated SEO suggestions:', suggestions);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: dbError } = await supabase
      .from('page_analysis')
      .upsert({
        url,
        title,
        content,
        main_keywords: keywords.exact_match,
        seo_keywords: keywords,
        suggestions: suggestions,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'url'
      });

    if (dbError) {
      console.error('Error storing analysis:', dbError);
    }

    const analysisResult = {
      keywords,
      outboundSuggestions: suggestions
    };

    console.log('Analysis completed:', analysisResult);
    return new Response(
      JSON.stringify(analysisResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});