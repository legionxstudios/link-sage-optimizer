import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.3";
import { logger } from "./logger.ts";

interface LinkSuggestion {
  suggestedAnchorText: string;
  context: string;
  relevanceScore: number;
  targetUrl: string;
}

export async function generateSEOSuggestions(content: string, keywords: string[], sourceUrl: string): Promise<LinkSuggestion[]> {
  try {
    logger.info('Generating SEO suggestions for URL:', sourceUrl);
    
    // Initialize Supabase client to fetch existing pages
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get existing pages from the database
    const { data: existingPages } = await supabase
      .from('pages')
      .select('url, title, content')
      .neq('url', sourceUrl)
      .limit(20);

    logger.info('Found existing pages:', existingPages?.length);

    const suggestions: LinkSuggestion[] = [];
    const sentences = content.split(/[.!?]+/);

    // For each keyword found in the content
    for (const keyword of keywords) {
      // Find sentences containing this keyword
      const relevantSentences = sentences.filter(s => 
        s.toLowerCase().includes(keyword.toLowerCase())
      );

      if (relevantSentences.length === 0) continue;

      // Find pages that contain this keyword
      const relevantPages = existingPages?.filter(page => 
        page.content?.toLowerCase().includes(keyword.toLowerCase()) ||
        page.title?.toLowerCase().includes(keyword.toLowerCase())
      ) || [];

      logger.info(`Found ${relevantPages.length} relevant pages for keyword: ${keyword}`);

      // For each relevant page, create a suggestion
      for (const page of relevantPages) {
        if (suggestions.length >= 10) break; // Limit to top 10 suggestions

        suggestions.push({
          suggestedAnchorText: keyword,
          context: relevantSentences[0].trim(),
          relevanceScore: 0.8, // High score for exact keyword matches
          targetUrl: page.url
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