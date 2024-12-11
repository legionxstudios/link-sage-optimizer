import { LinkSuggestion } from './types.ts';

export async function generateSuggestions(
  content: string,
  keywords: { [key: string]: string[] },
  existingLinks: { url: string; text: string; context: string }[]
): Promise<LinkSuggestion[]> {
  const suggestions: LinkSuggestion[] = [];
  const existingUrls = new Set(existingLinks.map(link => link.url));

  for (const [matchType, keywordList] of Object.entries(keywords)) {
    const relevanceMultiplier = {
      exact_match: 1.0,
      broad_match: 0.8,
      related_match: 0.6
    }[matchType] || 0.5;

    for (const keyword of keywordList) {
      try {
        const context = findKeywordContext(content, keyword);
        if (!context) continue;

        // Use Hugging Face for relevance validation
        const relevanceScore = await checkRelevance(context, keyword);
        if (relevanceScore < 0.3) continue;

        suggestions.push({
          suggestedAnchorText: keyword,
          context,
          matchType,
          relevanceScore: relevanceScore * relevanceMultiplier
        });
      } catch (error) {
        console.error(`Error processing keyword ${keyword}:`, error);
      }
    }
  }

  // Sort by relevance score and return top suggestions
  return suggestions
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 10);
}

async function checkRelevance(context: string, keyword: string): Promise<number> {
  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get('HUGGING_FACE_API_KEY')}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: context,
          parameters: {
            candidate_labels: [keyword]
          }
        }),
      }
    );

    const result = await response.json();
    return result.scores?.[0] || 0;
  } catch (error) {
    console.error('Error checking relevance:', error);
    return 0;
  }
}

function findKeywordContext(content: string, keyword: string): string | null {
  const sentences = content.split(/[.!?]+/);
  
  for (const sentence of sentences) {
    if (sentence.toLowerCase().includes(keyword.toLowerCase())) {
      return sentence.trim();
    }
  }
  
  return null;
}