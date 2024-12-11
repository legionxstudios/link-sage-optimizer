export function extractKeywords(content: string) {
  console.log('Processing content length:', content.length);
  
  // Process the full text in chunks to handle large content
  const chunks = splitIntoChunks(content, 5000);
  const allWords: { [key: string]: number } = {};
  
  chunks.forEach(chunk => {
    const words = chunk.toLowerCase()
      .split(/[\s.,!?;:()\[\]{}"']+/)
      .filter(word => word.length > 3)
      .filter(word => !commonWords.includes(word));
      
    words.forEach(word => {
      allWords[word] = (allWords[word] || 0) + 1;
    });
  });

  // Sort words by frequency and relevance
  const sortedWords = Object.entries(allWords)
    .sort(([, a], [, b]) => b - a)
    .filter(([word]) => !isCodeRelated(word))
    .map(([word]) => word);

  console.log('Extracted keywords count:', sortedWords.length);
  
  return {
    exact_match: sortedWords.slice(0, 15),  // Increased from 10 to get more relevant terms
    broad_match: sortedWords.slice(15, 30),
    related_match: sortedWords.slice(30, 45)
  };
}

function splitIntoChunks(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

function isCodeRelated(word: string): boolean {
  const codePatterns = [
    'function', 'const', 'let', 'var', 'return', 'import',
    'export', 'class', 'interface', 'type', 'enum',
    'async', 'await', 'try', 'catch', 'throw'
  ];
  return codePatterns.includes(word) || /^[_$]|[<>{}()]/.test(word);
}

const commonWords = [
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me'
];