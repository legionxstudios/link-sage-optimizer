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
  console.log('Starting content extraction for:', url);
  
  const response = await fetch(url);
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  if (!doc) {
    throw new Error('Failed to parse webpage');
  }

  const title = doc.querySelector('title')?.textContent || '';
  
  // Get main content area with improved selectors
  const mainContent = doc.querySelector('main, article, .content, .post-content, [role="main"], .entry-content, .article-content');
  let paragraphs: string[] = [];
  let existingLinks: Array<{ href: string; text: string }> = [];
  
  if (mainContent) {
    // Extract all text content from the main content area
    paragraphs = Array.from(mainContent.querySelectorAll('p, article, section'))
      .map(p => p.textContent?.trim() || '')
      .filter(text => text.length > 0); // Keep all paragraphs
      
    existingLinks = Array.from(mainContent.querySelectorAll('a[href]'))
      .map(link => ({
        href: link.getAttribute('href') || '',
        text: link.textContent?.trim() || ''
      }))
      .filter(link => link.href && !link.href.startsWith('#') && !link.href.startsWith('javascript:'));
  } else {
    // Fallback to body content if no main content area is found
    paragraphs = Array.from(doc.querySelectorAll('body p'))
      .map(p => p.textContent?.trim() || '')
      .filter(text => text.length > 0);
      
    existingLinks = Array.from(doc.querySelectorAll('body a[href]'))
      .map(link => ({
        href: link.getAttribute('href') || '',
        text: link.textContent?.trim() || ''
      }))
      .filter(link => link.href && !link.href.startsWith('#') && !link.href.startsWith('javascript:'));
  }

  const content = paragraphs.join('\n\n').trim();
  console.log('Extracted content length:', content.length);

  return {
    title,
    content,
    paragraphs,
    existingLinks
  };
};