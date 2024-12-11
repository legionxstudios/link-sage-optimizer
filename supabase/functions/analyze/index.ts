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

    // Generate SEO-focused link suggestions
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

async function generateSEOSuggestions(content: string, keywords: string[], sourceUrl: string) {
  try {
    // Define SEO-focused topics for content categorization
    const seoTopics = [
      "how-to guide",
      "tutorial",
      "case study", 
      "best practices",
      "industry trends",
      "expert tips",
      "comparison",
      "review",
      "guide",
      "resources"
    ];
    
    // Analyze content type using Hugging Face API
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
            candidate_labels: seoTopics
          }
        }),
      }
    );

    const result = await response.json();
    console.log('Content type analysis result:', result);

    if (result.error) {
      console.error('Hugging Face API error:', result.error);
      return [];
    }

    // Generate SEO-optimized suggestions
    const suggestions = [];
    const sentences = content.split(/[.!?]+/);

    // Add content type based suggestions
    if (result.scores && result.labels) {
      for (let i = 0; i < result.scores.length; i++) {
        if (result.scores[i] > 0.5) {
          const contentType = result.labels[i];
          const relevantSentence = sentences.find(s => 
            s.toLowerCase().includes(contentType.toLowerCase()) ||
            keywords.some(k => s.toLowerCase().includes(k.toLowerCase()))
          );

          if (relevantSentence) {
            // Generate SEO-optimized anchor text based on content type
            const topKeywords = keywords.slice(0, 2);
            const anchorText = generateSEOAnchorText(contentType, topKeywords);
            
            suggestions.push({
              suggestedAnchorText: anchorText,
              context: relevantSentence.trim(),
              matchType: 'seo_optimized',
              relevanceScore: result.scores[i],
              targetUrl: generateTargetUrl(contentType, keywords[0], sourceUrl),
              contentType: contentType
            });
          }
        }
      }
    }

    // Add keyword-based SEO suggestions
    for (const keyword of keywords.slice(0, 5)) {
      const relevantSentence = sentences.find(s => 
        s.toLowerCase().includes(keyword.toLowerCase())
      );

      if (relevantSentence) {
        const anchorText = generateSEOAnchorText('guide', [keyword]);
        suggestions.push({
          suggestedAnchorText: anchorText,
          context: relevantSentence.trim(),
          matchType: 'keyword_based',
          relevanceScore: 0.7,
          targetUrl: generateTargetUrl('guide', keyword, sourceUrl)
        });
      }
    }

    console.log('Generated SEO suggestions:', suggestions);
    return suggestions;

  } catch (error) {
    console.error('Error generating SEO suggestions:', error);
    return [];
  }
}

function generateSEOAnchorText(contentType: string, keywords: string[]): string {
  const templates = {
    'how-to guide': `How to ${keywords.join(' ')}`,
    'tutorial': `Complete Guide to ${keywords.join(' ')}`,
    'case study': `${keywords.join(' ')} Case Study`,
    'best practices': `Best Practices for ${keywords.join(' ')}`,
    'industry trends': `${keywords.join(' ')} Industry Trends`,
    'expert tips': `Expert Tips for ${keywords.join(' ')}`,
    'comparison': `${keywords.join(' ')} Comparison Guide`,
    'review': `${keywords.join(' ')} Review`,
    'guide': `Ultimate Guide to ${keywords.join(' ')}`,
    'resources': `${keywords.join(' ')} Resources`
  };

  return templates[contentType as keyof typeof templates] || 
         `Guide to ${keywords.join(' ')}`;
}

function generateTargetUrl(contentType: string, keyword: string, sourceUrl: string): string {
  try {
    const baseUrl = new URL(sourceUrl).origin;
    const slug = `${contentType.toLowerCase().replace(/\s+/g, '-')}/${keyword.toLowerCase().replace(/\s+/g, '-')}`;
    return `${baseUrl}/${slug}`;
  } catch (error) {
    console.error('Error generating target URL:', error);
    return '#';
  }
}