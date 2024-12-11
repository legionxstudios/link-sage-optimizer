export async function generateSuggestions(content: string, links: any[]) {
  const suggestions = [];
  const existingUrls = new Set(links.map(link => link.url));
  
  // Simple keyword-based suggestion generation
  const paragraphs = content
    .slice(0, 5000) // Limit content length
    .split(/\n+/)
    .filter(p => p.length > 50);

  for (const paragraph of paragraphs.slice(0, 5)) { // Limit paragraphs processed
    const words = paragraph
      .split(/\s+/)
      .filter(word => word.length > 4)
      .slice(0, 20); // Limit words processed

    for (let i = 0; i < words.length - 2; i++) {
      const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      
      if (phrase.length > 10 && !existingUrls.has(phrase)) {
        suggestions.push({
          suggestedAnchorText: phrase,
          context: paragraph.slice(0, 100),
          matchType: 'keyword',
          relevanceScore: 0.8
        });
      }
    }
  }

  return suggestions.slice(0, 10); // Return top 10 suggestions
}