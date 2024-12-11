export async function generateSuggestions(content: string, links: any[]) {
  try {
    const suggestions = [];
    const existingUrls = new Set(links.map(link => link.url));
    
    // Extract main topics/themes from content
    const topics = await analyzeTopics(content);
    console.log('Detected topics:', topics);
    
    // Generate SEO-friendly keywords based on topics
    const keywords = await generateSEOKeywords(content, topics);
    console.log('Generated SEO keywords:', keywords);
    
    // Find relevant contexts for each keyword
    for (const keyword of keywords) {
      const context = findKeywordContext(content, keyword);
      if (context) {
        suggestions.push({
          suggestedAnchorText: keyword,
          context: context,
          matchType: 'seo_optimized',
          relevanceScore: calculateRelevance(keyword, context, topics)
        });
      }
    }
    
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
              "photography", "art", "business", "technology",
              "travel", "lifestyle", "fashion", "food"
            ]
          }
        })
      }
    );
    
    const data = await response.json();
    return data.labels.filter((_: string, i: number) => data.scores[i] > 0.3);
  } catch (error) {
    console.error('Error analyzing topics:', error);
    return ['general'];
  }
}

async function generateSEOKeywords(content: string, topics: string[]) {
  try {
    const topicContext = `This is a website about ${topics.join(', ')}. `;
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
              "professional photography", "portrait photography",
              "photo studio", "photography services",
              "professional photographer", "photo session",
              "commercial photography", "event photography",
              "local photographer", "photography packages"
            ]
          }
        })
      }
    );
    
    const data = await response.json();
    return data.labels.filter((_: string, i: number) => data.scores[i] > 0.4);
  } catch (error) {
    console.error('Error generating SEO keywords:', error);
    return [];
  }
}

function findKeywordContext(content: string, keyword: string): string | null {
  const sentences = content.split(/[.!?]+/);
  const relevantSentence = sentences.find(s => 
    s.toLowerCase().includes(keyword.toLowerCase())
  );
  
  if (relevantSentence) {
    return relevantSentence.trim();
  }
  return null;
}

function calculateRelevance(
  keyword: string,
  context: string,
  topics: string[]
): number {
  let score = 0.5; // Base score
  
  // Boost score if keyword contains main topics
  if (topics.some(topic => 
    keyword.toLowerCase().includes(topic.toLowerCase())
  )) {
    score += 0.3;
  }
  
  // Boost score based on context relevance
  if (context.toLowerCase().includes(keyword.toLowerCase())) {
    score += 0.2;
  }
  
  return Math.min(score, 1); // Cap at 1.0
}