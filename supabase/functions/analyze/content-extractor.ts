import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

export interface ExtractedContent {
  title: string;
  content: string;
  paragraphs: string[];
  existingLinks: Array<{
    href: string;
    text: string;
  }>;
}

export const extractContent = async (url: string): Promise<ExtractedContent> => {
  const response = await fetch(url);
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  if (!doc) {
    throw new Error('Failed to parse webpage');
  }

  const title = doc.querySelector('title')?.textContent || '';
  
  // Get main content area
  const mainContent = doc.querySelector('main, article, .content, .post-content, [role="main"]');
  let paragraphs: string[] = [];
  let existingLinks: Array<{ href: string; text: string }> = [];
  
  if (mainContent) {
    paragraphs = Array.from(mainContent.querySelectorAll('p'))
      .map(p => p.textContent?.trim() || '')
      .filter(text => text.length > 50); // Only consider substantial paragraphs
      
    existingLinks = Array.from(mainContent.querySelectorAll('a[href]'))
      .map(link => ({
        href: link.getAttribute('href') || '',
        text: link.textContent?.trim() || ''
      }));
  } else {
    paragraphs = Array.from(doc.querySelectorAll('p'))
      .map(p => p.textContent?.trim() || '')
      .filter(text => text.length > 50);
      
    existingLinks = Array.from(doc.querySelectorAll('p a[href], article a[href]'))
      .map(link => ({
        href: link.getAttribute('href') || '',
        text: link.textContent?.trim() || ''
      }));
  }

  const content = paragraphs.join(' ').trim();

  return {
    title,
    content,
    paragraphs,
    existingLinks
  };
};