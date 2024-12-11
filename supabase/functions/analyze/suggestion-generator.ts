import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { LinkSuggestion } from "./types.ts";

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
              "photography", "portrait photography", "wedding photography",
              "commercial photography", "event photography", "fashion photography",
              "family photography", "product photography", "real estate photography"
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
              // Photography service keywords
              "professional photography services",
              "portrait photography packages",
              "wedding photographer",
              "family photo session",
              "commercial photography services",
              "product photography",
              "event photography packages",
              // Location-based keywords
              "local photographer",
              "photography studio",
              "on-location photography",
              // Specialty keywords
              "professional headshots",
              "engagement photos",
              "corporate photography",
              "real estate photography",
              // Action keywords
              "book photo session",
              "photography pricing",
              "photo gallery",
              "portfolio"
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