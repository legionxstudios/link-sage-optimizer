interface ParagraphAnalysis {
  text: string;
  keywords: string[];
  topics: string[];
}

export interface LinkSuggestion {
  sourceUrl: string;
  targetUrl: string;
  suggestedAnchorText: string;
  relevanceScore: number;
  context: string;
}

const findPotentialAnchors = (paragraph: string, keywords: string[]): string[] => {
  // Find noun phrases and important terms that could be good anchor text
  const words = paragraph.split(/\s+/);
  const potentialAnchors: string[] = [];
  
  // Look for 2-3 word phrases that might be good anchors
  for (let i = 0; i < words.length - 1; i++) {
    const twoWordPhrase = `${words[i]} ${words[i + 1]}`.toLowerCase();
    const threeWordPhrase = i < words.length - 2 ? 
      `${words[i]} ${words[i + 1]} ${words[i + 2]}`.toLowerCase() : '';
    
    // Check if phrase contains any keywords
    if (keywords.some(keyword => 
      twoWordPhrase.includes(keyword.toLowerCase()) || 
      threeWordPhrase.includes(keyword.toLowerCase())
    )) {
      if (threeWordPhrase) potentialAnchors.push(threeWordPhrase);
      potentialAnchors.push(twoWordPhrase);
    }
  }
  
  return [...new Set(potentialAnchors)]; // Remove duplicates
};

export const generateLinkSuggestions = async (
  paragraphs: string[],
  keywords: string[],
  targetUrl: string,
  existingLinks: Array<{ href: string; text: string }>
): Promise<LinkSuggestion[]> => {
  const suggestions: LinkSuggestion[] = [];
  const existingAnchorTexts = new Set(existingLinks.map(link => link.text.toLowerCase()));
  
  for (const paragraph of paragraphs) {
    const potentialAnchors = findPotentialAnchors(paragraph, keywords)
      .filter(anchor => !existingAnchorTexts.has(anchor.toLowerCase()));
    
    for (const anchorText of potentialAnchors) {
      try {
        // Analyze relevance using Hugging Face
        const relevanceResponse = await fetch(
          "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${Deno.env.get('HUGGING_FACE_API_KEY')}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              inputs: anchorText,
              parameters: {
                candidate_labels: [paragraph.substring(0, 200)],
                multi_label: false
              }
            }),
          }
        );

        const relevanceData = await relevanceResponse.json();
        
        if (!relevanceData.scores?.[0]) continue;
        
        const relevanceScore = relevanceData.scores[0];
        if (relevanceScore < 0.4) continue; // Only keep highly relevant suggestions
        
        // Find the context where this anchor could be placed
        const anchorIndex = paragraph.toLowerCase().indexOf(anchorText.toLowerCase());
        if (anchorIndex === -1) continue;
        
        const startContext = Math.max(0, anchorIndex - 100);
        const endContext = Math.min(paragraph.length, anchorIndex + anchorText.length + 100);
        let context = paragraph.substring(startContext, endContext);
        
        // Highlight where the link should go
        context = context.replace(
          new RegExp(anchorText, 'i'),
          `[${anchorText}]`
        );

        suggestions.push({
          sourceUrl: targetUrl,
          targetUrl: targetUrl, // This will be updated with relevant internal pages
          suggestedAnchorText: anchorText,
          relevanceScore,
          context
        });
      } catch (error) {
        console.error('Error analyzing potential link:', anchorText, error);
      }
    }
  }
  
  return suggestions;
};