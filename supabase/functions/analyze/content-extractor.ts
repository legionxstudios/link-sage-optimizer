import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

export async function extractContent(url: string) {
  console.log('Extracting content from:', url);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AnalyzerBot/1.0)'
    }
  });
  
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  if (!doc) {
    throw new Error('Failed to parse webpage');
  }

  const title = doc.querySelector('title')?.textContent || '';
  const mainContent = extractMainContent(doc);
  const links = extractLinks(doc);

  return {
    title,
    content: mainContent,
    links
  };
}

function extractMainContent(doc: Document): string {
  const contentSelectors = [
    'main',
    'article',
    '.content',
    '[role="main"]',
    '.post-content',
    '.entry-content'
  ];

  for (const selector of contentSelectors) {
    const element = doc.querySelector(selector);
    if (element) {
      return element.textContent?.trim() || '';
    }
  }

  // Fallback to body content
  return (doc.body?.textContent || '').trim();
}

function extractLinks(doc: Document) {
  return Array.from(doc.querySelectorAll('a[href]'))
    .slice(0, 100) // Limit number of links processed
    .map(link => ({
      url: link.getAttribute('href'),
      text: link.textContent?.trim() || '',
      context: extractLinkContext(link)
    }))
    .filter(link => link.url && !link.url.startsWith('#'));
}

function extractLinkContext(link: Element): string {
  const parent = link.parentElement;
  if (!parent) return '';

  const context = parent.textContent || '';
  const linkText = link.textContent || '';
  
  const parts = context.split(linkText);
  if (parts.length < 2) return context.slice(0, 100);

  const before = parts[0].slice(-50).trim();
  const after = parts[1].slice(0, 50).trim();

  return `${before} [LINK] ${after}`;
}