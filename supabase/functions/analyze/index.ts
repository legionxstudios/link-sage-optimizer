import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { extractContent } from "./content-analyzer.ts";
import { extractKeywords } from "./keyword-extractor.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Analyzing page content...');
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      throw new Error('Valid URL is required');
    }

    // Extract content with improved error handling
    const { title, content } = await extractContent(url);
    console.log('Content extracted, length:', content.length);

    // Process keywords and generate suggestions
    const keywords = extractKeywords(content);
    console.log('Keywords extracted:', keywords);

    // Generate link suggestions using AI
    const suggestions = await generateSuggestions(content, keywords);
    console.log('Generated suggestions:', suggestions);

    // Store analysis in database
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

async function generateSuggestions(content: string, keywords: any) {
  try {
    // Call Hugging Face API for content analysis
    const response = await fetch(
      "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get('HUGGING_FACE_API_KEY')}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: content.substring(0, 2000), // Analyze first 2000 chars
          parameters: {
            candidate_labels: [
              ...keywords.exact_match,
              "photography equipment",
              "camera reviews",
              "photography tutorials",
              "photo editing",
              "photography techniques",
              "camera comparison",
              "photography tips",
              "camera accessories"
            ]
          }
        }),
      }
    );

    const result = await response.json();
    console.log('AI analysis result:', result);

    // Generate suggestions based on AI analysis
    const suggestions = result.scores
      ?.map((score: number, index: number) => ({
        suggestedAnchorText: result.labels[index],
        context: findRelevantContext(content, result.labels[index]),
        matchType: score > 0.8 ? 'high_relevance' : 'medium_relevance',
        relevanceScore: score
      }))
      .filter((s: any) => s.relevanceScore > 0.5)
      .slice(0, 5) || [];

    return suggestions;
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return [];
  }
}

function findRelevantContext(content: string, keyword: string): string {
  const sentences = content.split(/[.!?]+/);
  const relevantSentence = sentences.find(s => 
    s.toLowerCase().includes(keyword.toLowerCase())
  );
  return relevantSentence?.trim() || 'Related content';
}