import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

export async function extractContent(url: string) {
  console.log('Extracting content from:', url);
  const response = await fetch(url);
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

  let content = '';
  for (const selector of contentSelectors) {
    const element = doc.querySelector(selector);
    if (element) {
      content = element.textContent || '';
      break;
    }
  }

  if (!content) {
    content = doc.body?.textContent || '';
  }

  return content.trim();
}

function extractLinks(doc: Document) {
  return Array.from(doc.querySelectorAll('a[href]')).map(link => ({
    url: link.getAttribute('href'),
    text: link.textContent?.trim() || '',
    context: extractLinkContext(link)
  }));
}

function extractLinkContext(link: Element): string {
  const parent = link.parentElement;
  if (!parent) return '';

  const context = parent.textContent || '';
  const linkText = link.textContent || '';
  
  const parts = context.split(linkText);
  if (parts.length < 2) return context;

  const before = parts[0].slice(-50).trim();
  const after = parts[1].slice(0, 50).trim();

  return `${before} [LINK] ${after}`;
}