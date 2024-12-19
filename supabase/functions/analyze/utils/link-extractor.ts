import { ExistingLink } from "./types.ts";
import { logger } from "./logger.ts";

export function extractExistingLinks(content: string): ExistingLink[] {
  const links: ExistingLink[] = [];
  const linkRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    links.push({
      url: match[1],
      anchorText: match[2].replace(/<[^>]*>/g, '').trim()
    });
  }

  logger.info('Extracted existing links:', links);
  return links;
}