export function extractKeywords(content: string) {
  const words = content.toLowerCase()
    .split(/[\s.,!?;:()\[\]{}"']+/)
    .filter(word => word.length > 3)
    .filter(word => !commonWords.includes(word));

  const wordFreq: { [key: string]: number } = {};
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });

  const phrases = [];
  for (let i = 0; i < words.length - 1; i++) {
    phrases.push(`${words[i]} ${words[i + 1]}`);
    if (i < words.length - 2) {
      phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }
  }

  const allKeywords = [...Object.keys(wordFreq), ...phrases];
  const sortedKeywords = allKeywords.sort((a, b) => 
    (wordFreq[b] || 0) - (wordFreq[a] || 0)
  );

  const totalKeywords = sortedKeywords.length;
  return {
    exact_match: sortedKeywords.slice(0, Math.floor(totalKeywords * 0.4)),
    broad_match: sortedKeywords.slice(Math.floor(totalKeywords * 0.4), Math.floor(totalKeywords * 0.7)),
    related_match: sortedKeywords.slice(Math.floor(totalKeywords * 0.7))
  };
}

const commonWords = [
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what'
];