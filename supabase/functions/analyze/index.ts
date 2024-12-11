import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { extractContent } from "./content-analyzer.ts";
import { extractKeywords } from "./keyword-extractor.ts";
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

    const keywords = extractKeywords(content);
    console.log('Keywords extracted:', keywords);

    // Generate link suggestions using content analysis
    const suggestions = await generateSuggestionsFromContent(content, keywords.exact_match);
    console.log('Generated suggestions:', suggestions);

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

async function generateSuggestionsFromContent(content: string, keywords: string[]) {
  try {
    // Select top 5 keywords for analysis to stay within API limits
    const topKeywords = keywords.slice(0, 5);
    
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
          inputs: content.substring(0, 2000),
          parameters: {
            candidate_labels: [
              "technology",
              "business",
              "marketing",
              "software",
              "digital",
              "services",
              "solutions",
              "products",
              "support",
              "tools"
            ]
          }
        }),
      }
    );

    const result = await response.json();
    console.log('Content analysis result:', result);

    if (result.error) {
      console.error('Hugging Face API error:', result.error);
      return [];
    }

    // Generate suggestions based on content analysis and keywords
    const suggestions = [];
    const sentences = content.split(/[.!?]+/);

    // Add suggestions based on content analysis
    if (result.scores && result.labels) {
      for (let i = 0; i < result.scores.length; i++) {
        if (result.scores[i] > 0.5) { // Only use high confidence matches
          const relevantSentence = sentences.find(s => 
            s.toLowerCase().includes(result.labels[i].toLowerCase())
          );

          if (relevantSentence) {
            suggestions.push({
              suggestedAnchorText: result.labels[i],
              context: relevantSentence.trim(),
              matchType: result.scores[i] > 0.8 ? 'high_relevance' : 'medium_relevance',
              relevanceScore: result.scores[i]
            });
          }
        }
      }
    }

    // Add keyword-based suggestions
    for (const keyword of topKeywords) {
      const relevantSentence = sentences.find(s => 
        s.toLowerCase().includes(keyword.toLowerCase())
      );

      if (relevantSentence) {
        suggestions.push({
          suggestedAnchorText: keyword,
          context: relevantSentence.trim(),
          matchType: 'keyword_based',
          relevanceScore: 0.7 // Default score for keyword matches
        });
      }
    }

    console.log('Generated suggestions:', suggestions);
    return suggestions;

  } catch (error) {
    console.error('Error generating suggestions:', error);
    return [];
  }
}