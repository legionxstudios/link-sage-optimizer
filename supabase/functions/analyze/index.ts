import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const HF_API_KEY = Deno.env.get('HUGGING_FACE_API_KEY');

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

    const response = await fetch(url);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    if (!doc) {
      throw new Error('Failed to parse webpage');
    }

    const title = doc.querySelector('title')?.textContent || '';
    
    // Get main content area
    const mainContent = doc.querySelector('main, article, .content, .post-content, [role="main"]');
    let contentLinks;
    let paragraphs;
    
    if (mainContent) {
      // If we found a main content area, get links and paragraphs only from there
      contentLinks = Array.from(mainContent.querySelectorAll('a[href]'));
      paragraphs = Array.from(mainContent.querySelectorAll('p'));
    } else {
      // Fallback: get all links from paragraphs (likely content, not navigation)
      contentLinks = Array.from(doc.querySelectorAll('p a[href], article a[href]'));
      paragraphs = Array.from(doc.querySelectorAll('p'));
    }

    const baseUrl = new URL(url).origin;
    const links = contentLinks
      .map(link => {
        const href = link.getAttribute('href');
        const text = link.textContent?.trim();
        
        // Find the containing paragraph
        const containingParagraph = link.closest('p');
        let context = '';
        
        if (containingParagraph) {
          const paragraphText = containingParagraph.textContent?.trim() || '';
          // Get text before and after the link text within the paragraph
          const linkIndex = paragraphText.indexOf(text || '');
          if (linkIndex !== -1) {
            const startContext = Math.max(0, linkIndex - 100);
            const endContext = Math.min(paragraphText.length, linkIndex + (text?.length || 0) + 100);
            context = paragraphText.substring(startContext, endContext);
            // Highlight where the link should go
            context = context.replace(text || '', `[${text}]`);
          }
        }

        return {
          href,
          text,
          context
        };
      })
      .filter(link => {
        if (!link.href || !link.text) return false;
        
        // Ensure it's an internal link
        const isInternal = link.href.startsWith('/') || link.href.startsWith(baseUrl);
        
        // Filter out common navigation patterns
        const isNavigation = /^(home|about|contact|services|blog|booking)$/i.test(link.text);
        const isBrandName = link.text.toLowerCase().includes('legionx') || link.text.toLowerCase().includes('studios');
        
        return isInternal && !isNavigation && !isBrandName;
      });

    console.log('Found valid links:', links.length);

    const content = paragraphs
      .map(p => p.textContent)
      .join(' ')
      .trim();

    const keywordResponse = await fetch(
      "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: content.substring(0, 1000),
          parameters: {
            candidate_labels: [
              "technology", "business", "health", "education", 
              "entertainment", "sports", "science", "politics", 
              "lifestyle", "travel"
            ],
            multi_label: true
          }
        }),
      }
    );

    const keywordData = await keywordResponse.json();
    console.log('Keyword analysis response:', keywordData);

    if (!keywordData.labels || !keywordData.scores) {
      throw new Error('Invalid response from Hugging Face keyword analysis');
    }
    
    const mainKeywords = keywordData.labels.filter((_, index) => 
      keywordData.scores[index] > 0.3
    );

    const suggestions = await Promise.all(
      links.map(async (link) => {
        try {
          if (!link.text) return null;

          const relevanceResponse = await fetch(
            "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${HF_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                inputs: link.text,
                parameters: {
                  candidate_labels: [content.substring(0, 200)],
                  multi_label: false
                }
              }),
            }
          );

          const relevanceData = await relevanceResponse.json();
          console.log('Relevance analysis for link:', link.text, relevanceData);

          if (!relevanceData.scores || !relevanceData.scores[0]) {
            console.log('Invalid relevance score for link:', link.text);
            return null;
          }
          
          const relevanceScore = relevanceData.scores[0];
          const fullUrl = link.href?.startsWith('/') ? `${baseUrl}${link.href}` : link.href;

          return {
            sourceUrl: fullUrl,
            targetUrl: url,
            suggestedAnchorText: link.text,
            relevanceScore,
            context: link.context || 'No context available'
          };
        } catch (error) {
          console.error('Error analyzing link:', link.text, error);
          return null;
        }
      })
    );

    const validSuggestions = suggestions.filter(s => s !== null);
    console.log('Valid suggestions:', validSuggestions.length);

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
        suggestions: validSuggestions
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
        suggestions: validSuggestions
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