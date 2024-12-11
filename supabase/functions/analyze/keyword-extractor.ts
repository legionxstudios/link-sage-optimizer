export function extractKeywords(content: string) {
  console.log('Extracting keywords from content...');
  
  const words = content.toLowerCase()
    .slice(0, 5000) // Limit content length for processing
    .split(/[\s.,!?;:()\[\]{}"']+/)
    .filter(word => word.length > 3)
    .filter(word => !commonWords.includes(word));

  const wordFreq: { [key: string]: number } = {};
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });

  const sortedWords = Object.entries(wordFreq)
    .sort(([, a], [, b]) => b - a)
    .map(([word]) => word);

  console.log('Keyword extraction complete');
  
  return {
    exact_match: sortedWords.slice(0, 10),
    broad_match: sortedWords.slice(10, 20),
    related_match: sortedWords.slice(20, 30)
  };
}

const commonWords = [
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what'
];