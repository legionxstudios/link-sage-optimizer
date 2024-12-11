import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { LinkSuggestion } from "./types.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function generateSuggestions(content: string, links: any[]) {
  try {
    console.log('Starting suggestion generation');
    const suggestions: LinkSuggestion[] = [];
    const existingUrls = new Set(links.map(link => link.url));
    
    // Extract main topics/themes from content
    const themes = await analyzeTopics(content);
    console.log('Detected website themes:', themes);
    
    // Generate SEO-friendly keywords based on themes
    const keywords = await generateSEOKeywords(content, themes);
    console.log('Generated SEO keywords:', keywords);
    
    // Generate suggestions based on keywords and themes
    for (const keyword of keywords) {
      const context = findKeywordContext(content, keyword.keyword);
      if (context) {
        suggestions.push({
          suggestedAnchorText: keyword.keyword,
          context: context,
          matchType: 'seo_optimized',
          relevanceScore: keyword.relevance
        });
      }
    }
    
    // Store the analysis results
    await storeAnalysisResults(content, themes, keywords, suggestions);
    
    console.log('Generated suggestions:', suggestions);
    return suggestions
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 10);
      
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return [];
  }
}

async function analyzeTopics(content: string) {
  try {
    console.log('Analyzing website themes...');
    const response = await fetch(
      "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('HUGGING_FACE_API_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: content.slice(0, 1000),
          parameters: {
            candidate_labels: [
              "photography", "portrait photography", 
              "wedding photography", "commercial photography",
              "event photography"
            ]
          }
        })
      }
    );
    
    const data = await response.json();
    console.log('Theme analysis response:', data);

    if (!data.labels || !data.scores) {
      console.error('Invalid theme analysis response:', data);
      return ['photography'];
    }

    return data.labels.filter((_: string, i: number) => data.scores[i] > 0.3);
  } catch (error) {
    console.error('Error analyzing topics:', error);
    return ['photography'];
  }
}

async function generateSEOKeywords(content: string, themes: string[]) {
  try {
    console.log('Generating SEO keywords for themes:', themes);
    const topicContext = `This is a website about ${themes.join(', ')}. `;
    const response = await fetch(
      "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('HUGGING_FACE_API_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: `${topicContext}Generate SEO keywords from: ${content.slice(0, 500)}`,
          parameters: {
            candidate_labels: [
              "professional photography",
              "portrait session",
              "wedding photographer",
              "family photos",
              "commercial photography",
              "photo studio",
              "professional headshots",
              "event photography",
              "photo packages",
              "photography portfolio"
            ]
          }
        })
      }
    );
    
    const data = await response.json();
    console.log('SEO keyword generation response:', data);

    if (!data.labels || !data.scores) {
      console.error('Invalid SEO keyword response:', data);
      return [];
    }
    
    return data.labels
      .map((label: string, index: number) => ({
        keyword: label,
        relevance: data.scores[index]
      }))
      .filter((kw: any) => kw.relevance > 0.4)
      .sort((a: any, b: any) => b.relevance - a.relevance);
  } catch (error) {
    console.error('Error generating SEO keywords:', error);
    return [];
  }
}

async function storeAnalysisResults(content: string, themes: string[], keywords: any[], suggestions: LinkSuggestion[]) {
  try {
    const { error } = await supabase
      .from('page_analysis')
      .insert({
        content: content.slice(0, 10000), // Limit content length
        detected_themes: themes,
        seo_keywords: keywords,
        suggestions: suggestions
      });

    if (error) {
      console.error('Error storing analysis results:', error);
    } else {
      console.log('Analysis results stored successfully');
    }
  } catch (error) {
    console.error('Error storing analysis results:', error);
  }
}

function findKeywordContext(content: string, keyword: string): string | null {
  const sentences = content.split(/[.!?]+/);
  const relevantSentences = sentences.filter(s => 
    s.toLowerCase().includes(keyword.toLowerCase())
  );
  
  if (relevantSentences.length > 0) {
    // Get the most relevant sentence (usually the first mention)
    const context = relevantSentences[0].trim();
    // Highlight the keyword in the context
    return context.replace(
      new RegExp(`(${keyword})`, 'gi'),
      '[$1]'
    );
  }
  return null;
}