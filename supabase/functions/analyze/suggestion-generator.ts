import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface LinkSuggestion {
  suggestedAnchorText: string;
  context: string;
  matchType: string;
  relevanceScore: number;
}

export async function generateSuggestions(
  content: string,
  links: any[],
  url: string,
  title: string | null
): Promise<LinkSuggestion[]> {
  try {
    console.log('Starting suggestion generation for URL:', url);
    
    // Extract main topics from content using Hugging Face API
    const topics = await analyzeTopics(content);
    console.log('Detected topics:', topics);

    // Generate suggestions based on topics
    const suggestions: LinkSuggestion[] = [];
    
    for (const topic of topics) {
      const context = findTopicContext(content, topic.label);
      if (context) {
        suggestions.push({
          suggestedAnchorText: topic.label,
          context: context,
          matchType: 'topic_based',
          relevanceScore: topic.score
        });
      }
    }

    console.log(`Generated ${suggestions.length} suggestions`);
    return suggestions
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 10);

  } catch (error) {
    console.error('Error generating suggestions:', error);
    // Return empty array instead of throwing to prevent entire analysis from failing
    return [];
  }
}

async function analyzeTopics(content: string) {
  const apiKey = Deno.env.get('HUGGING_FACE_API_KEY');
  if (!apiKey) {
    console.error('Missing Hugging Face API key');
    return [];
  }

  try {
    console.log('Analyzing topics with Hugging Face API...');
    const response = await fetch(
      "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: content.slice(0, 1000),
          parameters: {
            candidate_labels: [
              "technology", "business", "science", "health",
              "education", "entertainment", "sports", "politics",
              "environment", "lifestyle"
            ],
            multi_label: true
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Hugging Face API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Topic analysis response:', data);

    if (!data.labels || !data.scores) {
      throw new Error('Invalid topic analysis response');
    }

    return data.labels
      .map((label: string, index: number) => ({
        label,
        score: data.scores[index]
      }))
      .filter((topic: any) => topic.score > 0.3);

  } catch (error) {
    console.error('Error analyzing topics:', error);
    return [];
  }
}

function findTopicContext(content: string, topic: string): string | null {
  const sentences = content.split(/[.!?]+/);
  const relevantSentences = sentences.filter(s => 
    s.toLowerCase().includes(topic.toLowerCase())
  );
  
  if (relevantSentences.length > 0) {
    const context = relevantSentences[0].trim();
    return context.replace(
      new RegExp(`(${topic})`, 'gi'),
      '[$1]'
    );
  }
  return null;
}