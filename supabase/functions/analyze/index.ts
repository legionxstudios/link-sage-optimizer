import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getOrCreateWebsite, savePage, savePageAnalysis } from "./db.ts";
import { extractContent } from "./content-analyzer.ts";
import { extractKeywords } from "./keyword-extractor.ts";
import { generateSuggestions } from "./suggestion-generator.ts";
import { AnalysisResult } from "./types.ts";

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
    console.log('Starting analysis for:', url);

    if (!url) {
      throw new Error('URL is required');
    }

    // Get domain from URL
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    console.log('Domain:', domain);

    // Create or update website record
    const website = await getOrCreateWebsite(domain);
    console.log('Website record:', website);

    // Extract content
    const { title, content, links } = await extractContent(url);
    console.log('Content extracted, length:', content.length);

    // Save page
    const page = await savePage(website.id, url, title, content);
    console.log('Page saved:', page.id);

    // Extract keywords
    const keywords = extractKeywords(content);
    console.log('Keywords extracted:', Object.keys(keywords).length);

    // Generate suggestions
    const suggestions = await generateSuggestions(content, keywords, links);
    console.log('Suggestions generated:', suggestions.length);

    const analysisResult: AnalysisResult = {
      keywords,
      outboundSuggestions: suggestions
    };

    // Save analysis results
    await savePageAnalysis(url, {
      title,
      content,
      keywords,
      outboundSuggestions: suggestions
    });

    console.log('Analysis completed:', analysisResult);

    return new Response(
      JSON.stringify(analysisResult),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});