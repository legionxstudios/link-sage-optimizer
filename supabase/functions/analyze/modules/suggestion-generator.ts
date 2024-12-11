import { logger } from "./logger.ts";

interface Page {
  url: string;
  title?: string;
  content?: string;
}

export async function generateSEOSuggestions(
  content: string, 
  keywords: string[], 
  sourceUrl: string,
  relevantPages: Page[]
) {
  try {
    logger.info('Generating SEO suggestions for URL:', sourceUrl);
    logger.info('Found relevant pages:', relevantPages.length);

    const suggestions = [];
    const sentences = content.split(/[.!?]+/);

    // For each keyword found in the content
    for (const keyword of keywords) {
      // Find sentences containing this keyword
      const relevantSentences = sentences.filter(s => 
        s.toLowerCase().includes(keyword.toLowerCase())
      );

      if (relevantSentences.length === 0) continue;

      // Find pages that contain this keyword
      const matchingPages = relevantPages.filter(page => 
        page.content?.toLowerCase().includes(keyword.toLowerCase()) ||
        page.title?.toLowerCase().includes(keyword.toLowerCase())
      );

      logger.info(`Found ${matchingPages.length} matching pages for keyword: ${keyword}`);

      // For each matching page, create a suggestion
      for (const page of matchingPages) {
        if (suggestions.length >= 10) break; // Limit to top 10 suggestions

        suggestions.push({
          suggestedAnchorText: keyword,
          context: relevantSentences[0].trim(),
          matchType: "keyword_based",
          relevanceScore: calculateRelevanceScore(keyword, page),
          targetUrl: page.url,
          targetTitle: page.title || ''
        });
      }
    }

    logger.info('Generated suggestions:', suggestions.length);
    return suggestions;
  } catch (error) {
    logger.error('Error generating SEO suggestions:', error);
    return [];
  }
}

function calculateRelevanceScore(keyword: string, page: Page): number {
  let score = 0;
  
  // Check title
  if (page.title?.toLowerCase().includes(keyword.toLowerCase())) {
    score += 0.5;
  }
  
  // Check content
  if (page.content?.toLowerCase().includes(keyword.toLowerCase())) {
    const frequency = (page.content.toLowerCase().match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
    score += Math.min(0.5, frequency * 0.1); // Cap at 0.5
  }
  
  return Math.min(1.0, score);
}