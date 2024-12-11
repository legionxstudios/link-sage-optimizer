import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.3";
import { ThemeAnalyzer } from "./theme-analyzer.ts";

interface LinkSuggestion {
  suggestedAnchorText: string;
  context: string;
  matchType: string;
  relevanceScore: number;
  targetUrl?: string;
}

export class SuggestionGenerator {
  private readonly supabase;

  constructor() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async generateSuggestions(content: string, url: string): Promise<LinkSuggestion[]> {
    try {
      console.log('Generating suggestions for URL:', url);
      
      // Get themes from content
      const themes = await ThemeAnalyzer.analyzeThemes(content);
      console.log('Content themes:', themes);

      // Get related pages from database
      const relatedPages = await this.findRelatedPages(themes, url);
      console.log('Found related pages:', relatedPages.length);

      const suggestions: LinkSuggestion[] = [];

      // Generate suggestions from related pages
      for (const page of relatedPages) {
        if (suggestions.length >= 10) break;

        const relevanceScore = this.calculateRelevanceScore(page, themes);
        if (relevanceScore < 0.3) continue;

        const context = this.findBestContext(content, page.title);
        
        suggestions.push({
          suggestedAnchorText: page.title,
          context: context || 'Related content',
          matchType: 'theme_based',
          relevanceScore,
          targetUrl: page.url
        });
      }

      console.log('Generated suggestions:', suggestions.length);
      return suggestions;
    } catch (error) {
      console.error('Error generating suggestions:', error);
      return [];
    }
  }

  private async findRelatedPages(themes: string[], currentUrl: string) {
    const { data: pages } = await this.supabase
      .from('pages')
      .select('url, title, content')
      .neq('url', currentUrl)
      .limit(20);

    return pages || [];
  }

  private calculateRelevanceScore(page: any, themes: string[]): number {
    let score = 0;
    const pageContent = (page.content || '').toLowerCase();
    
    for (const theme of themes) {
      if (pageContent.includes(theme.toLowerCase())) {
        score += 0.2;
      }
    }

    return Math.min(score, 1);
  }

  private findBestContext(content: string, keyword: string): string | null {
    const sentences = content.split(/[.!?]+/);
    const relevantSentence = sentences.find(s => 
      s.toLowerCase().includes(keyword.toLowerCase())
    );

    return relevantSentence?.trim() || null;
  }
}