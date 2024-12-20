import { ExistingPage } from "./types.ts";
import { logger } from "./logger.ts";

export function generateSuggestions(
  keywords: { [key: string]: string[] },
  existingPages: ExistingPage[]
) {
  logger.info('Starting suggestion generation with keywords:', keywords);
  logger.info(`Working with ${existingPages.length} existing pages`);

  const suggestions = [];
  const usedUrls = new Set<string>();
  const usedAnchorTexts = new Set<string>();

  // Get all valid domains that should be considered internal
  const internalDomains = new Set(['legionxstudios.com', 'www.legionxstudios.com']);
  logger.info(`Using internal domains:`, Array.from(internalDomains));

  // Process each keyword type with different relevance thresholds
  const keywordTypes = {
    exact_match: 0.2,
    broad_match: 0.15,
    related_match: 0.1
  };

  // Process each keyword type
  for (const [matchType, threshold] of Object.entries(keywordTypes)) {
    const keywordList = keywords[matchType as keyof typeof keywords] || [];
    logger.info(`Processing ${keywordList.length} ${matchType} keywords with threshold ${threshold}`);

    for (const keyword of keywordList) {
      const actualKeyword = keyword.split('(')[0].trim().toLowerCase();
      
      // Skip if we've already used this anchor text
      if (usedAnchorTexts.has(actualKeyword)) {
        logger.info(`Skipping duplicate anchor text: "${actualKeyword}"`);
        continue;
      }

      logger.info(`Processing keyword: "${actualKeyword}"`);
      
      // Find matching pages for this keyword
      const matchingPages = findMatchingPages(actualKeyword, existingPages, usedUrls, internalDomains);
      logger.info(`Found ${matchingPages.length} potential matches for "${actualKeyword}"`);
      
      // Find the best matching page for this keyword
      let bestMatch = null;
      let bestScore = 0;

      for (const page of matchingPages) {
        // Skip if the URL is external
        if (!isInternalUrl(page.url, internalDomains)) {
          logger.info(`Skipping external URL: ${page.url}`);
          continue;
        }

        const score = calculateRelevanceScore(actualKeyword, page);
        if (score > bestScore && score > threshold) {
          bestScore = score;
          bestMatch = page;
        }
      }

      if (bestMatch && !usedUrls.has(bestMatch.url)) {
        suggestions.push({
          suggestedAnchorText: keyword.split('(')[0].trim(),
          targetUrl: bestMatch.url,
          targetTitle: bestMatch.title || '',
          context: extractContext(bestMatch.content || '', actualKeyword),
          matchType: matchType,
          relevanceScore: bestScore
        });
        
        // Track used URL and anchor text
        usedUrls.add(bestMatch.url);
        usedAnchorTexts.add(actualKeyword);
        logger.info(`Added suggestion for "${actualKeyword}" -> ${bestMatch.url}`);
      }

      // Break if we have enough suggestions
      if (suggestions.length >= 20) {
        logger.info('Reached maximum suggestion count');
        break;
      }
    }
  }

  logger.info(`Generated ${suggestions.length} total suggestions`);
  logger.debug('Final suggestions:', suggestions);
  return suggestions;
}

function findMatchingPages(
  keyword: string, 
  existingPages: ExistingPage[], 
  usedUrls: Set<string>,
  internalDomains: Set<string>
): ExistingPage[] {
  const keywordLower = keyword.toLowerCase();
  
  return existingPages.filter(page => {
    // Skip already used URLs and invalid pages
    if (!page.url || usedUrls.has(page.url)) return false;
    
    // Skip non-content pages and external URLs
    if (!isInternalUrl(page.url, internalDomains) ||
        page.url.includes('/wp-content/') ||
        page.url.includes('/cart') ||
        page.url.includes('/checkout') ||
        page.url.includes('/my-account') ||
        page.url.match(/\.(jpg|jpeg|png|gif|css|js)$/)) {
      return false;
    }
    
    // Check if keyword appears in URL slug
    const urlSlug = new URL(page.url).pathname.toLowerCase();
    if (urlSlug.includes(keywordLower.replace(/\s+/g, '-'))) {
      return true;
    }
    
    // Check if keyword appears in title or content
    const titleMatch = page.title?.toLowerCase().includes(keywordLower);
    const contentMatch = page.content?.toLowerCase().includes(keywordLower);
    
    return titleMatch || contentMatch;
  });
}

function calculateRelevanceScore(keyword: string, page: ExistingPage): number {
  let score = 0;
  const keywordLower = keyword.toLowerCase();
  
  // Theme-based scoring (highest weight - 0.4)
  if (page.metadata?.detected_themes) {
    const themes = page.metadata.detected_themes as string[];
    const themeScore = calculateThemeScore(keywordLower, themes);
    score += themeScore * 0.4;
    logger.info(`Theme score for "${keyword}": ${themeScore}`);
  }
  
  // URL slug relevance (0.3 weight)
  const urlSlug = new URL(page.url).pathname.toLowerCase();
  if (urlSlug.includes(keywordLower.replace(/\s+/g, '-'))) {
    score += 0.3;
    logger.info(`URL match found for "${keyword}"`);
  }
  
  // Title relevance (0.2 weight)
  if (page.title?.toLowerCase().includes(keywordLower)) {
    score += 0.2;
    logger.info(`Title match found for "${keyword}"`);
  }
  
  // Content relevance and frequency (0.1 weight)
  if (page.content?.toLowerCase().includes(keywordLower)) {
    const frequency = (page.content.toLowerCase().match(new RegExp(keywordLower, 'g')) || []).length;
    const normalizedFrequency = Math.min(frequency / 10, 1); // Normalize frequency, cap at 10 occurrences
    score += normalizedFrequency * 0.1;
    logger.info(`Content frequency score for "${keyword}": ${normalizedFrequency}`);
  }
  
  logger.info(`Final relevance score for "${keyword}": ${score}`);
  return Math.min(1.0, score);
}

function calculateThemeScore(keyword: string, themes: string[]): number {
  // If no themes are available, return a neutral score
  if (!themes || themes.length === 0) {
    return 0.5;
  }

  // Calculate how many themes contain the keyword or vice versa
  let themeMatches = 0;
  for (const theme of themes) {
    const themeLower = theme.toLowerCase();
    if (themeLower.includes(keyword) || keyword.includes(themeLower)) {
      themeMatches++;
    }
  }

  // Calculate score based on theme matches
  const themeScore = themeMatches / themes.length;
  logger.info(`Theme matches for "${keyword}": ${themeMatches}/${themes.length}`);
  
  return themeScore;
}

function extractContext(content: string, keyword: string): string {
  const keywordLower = keyword.toLowerCase();
  const contentLower = content.toLowerCase();
  const keywordIndex = contentLower.indexOf(keywordLower);
  
  if (keywordIndex === -1) return "";
  
  const start = Math.max(0, keywordIndex - 100);
  const end = Math.min(content.length, keywordIndex + keyword.length + 100);
  let context = content.slice(start, end).trim();
  
  // Highlight the keyword in the context
  const regex = new RegExp(keyword, 'gi');
  context = context.replace(regex, `[${keyword}]`);
  
  return context;
}

function isInternalUrl(url: string, internalDomains: Set<string>): boolean {
  try {
    const urlDomain = new URL(url).hostname.toLowerCase();
    return internalDomains.has(urlDomain);
  } catch (error) {
    logger.error(`Error checking if URL is internal: ${error}`);
    return false;
  }
}